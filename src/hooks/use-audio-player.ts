import { CHUNK_TO_PAUSE_ON, FORWARD_REWIND_TIME, LOADING_TIMEOUT, LOADING_TIMEOUT_FOR_DOWNLOAD, PLAY_RATE_STEP, TOAST_STYLE_CONFIG, TOAST_STYLE_CONFIG_INFO } from "@/lib/constants";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import useAudioUrl from "./use-audio-url";
import useAuthToken from "./use-auth-token";
import { useToast } from "./use-toast";
const useAudioPlayer = (isDownload: boolean) => {
    const { toast, dismiss } = useToast();
    const { chunks, blobs, downloadPreviewText, downloadCombinedFile, progress, setProgress, isFetching, wasPromptStopped, setWasPromptStopped, setIsPromptingPaused, isPromptingPaused, audioUrls, ended, extractText, splitAndSendPrompt, text, reset: resetAudioUrl, voices, setVoices, isVoiceLoading, is9ThChunk, reStartChunkProcess, setIs9thChunk, isLoading } = useAudioUrl(isDownload);
    const { isAuthenticated } = useAuthToken();
    const [isPlaying, setIsPlaying] = useState<boolean>(false);
    const [isPaused, setIsPaused] = useState<boolean>(false);
    const [isAudioLoading, setAudioLoading] = useState<boolean>(false);
    const [hasCompletePlaying, setHasCompletePlaying] = useState<boolean>(false);
    const [currentIndex, setCurrentIndex] = useState<number>(0)
    const [playRate, setPlayRate] = useState<number>(1);
    const [volume, setVolume] = useState<number>(0.5);
    const [isBackPressed, setIsBackPressed] = useState<boolean>(false);
    const [timeoutId, setTimeoutId] = useState<NodeJS.Timeout | null>(null);
    const [isPresenceModalOpen, setIsPresenceModalOpen] = useState<boolean>(false);
    const [playTimeDuration, setPlayTimeDuration] = useState<number>(0);
    const [currentPlayTime, setCurrentPlayTime] = useState<number>(0);
    const [partialChunkCompletedPlaying, setPartialChunkCompletedPlaying] = useState<boolean>(false);
    const [arrayBuffers, setArrayBuffers] = useState<ArrayBuffer[]>([]);
    const [isTypeAACSupported, setIsTypeAACSupported] = useState<boolean>(true);
    const [isStreamLoading, setIsStreamLoading] = useState<boolean>(false);
    const [audioUrlsBeforeStop, setAudioUrlsBeforeStop] = useState<number>(audioUrls.length);
    const memoryWarnedRef = useRef(false);

    const toast15SecRef = useRef<string | null>(null);
    const infoToastIdRef = useRef<string | null>(null);
    const currentTimeRef = useRef<number>(0);
    const isScrubbing = useRef<boolean>(false);

    const sourceBuffer = useRef<SourceBuffer | null>(null);
    const mediaSource = useMemo(() => new MediaSource(), [isBackPressed]);
    const seekAudio = useMemo(() => new Audio(URL.createObjectURL(mediaSource)), [mediaSource]);
    const thresholdsRef = useRef<number[]>([0]);
    const triggeredThresholdsRef = useRef<Set<number>>(new Set());
  
    //resetting the media source when the user clicks on the back button or onUnmount
    const endMediaStream = () => {
        if (sourceBuffer.current) {
            sourceBuffer.current.abort();
            sourceBuffer.current = null;
            try {
                if (!mediaSource || mediaSource.readyState !== "open") return;
                mediaSource.endOfStream();
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
            } catch (error) {
                // console.log("Error closing MediaSource:", error);
            }
        }
    }

    mediaSource.onsourceopen = () => {
        if (!mediaSource || mediaSource.readyState !== "open") return;

        try {
            if (!MediaSource.isTypeSupported('audio/aac')) {
                setIsTypeAACSupported(false);
                return
            }
            sourceBuffer.current = mediaSource.addSourceBuffer('audio/aac'); // AAC codec

            sourceBuffer.current.onupdateend = () => {
                if (arrayBuffers.length > 0 && sourceBuffer.current && !sourceBuffer.current.updating) {
                    sourceBuffer.current.appendBuffer(arrayBuffers.shift() as ArrayBuffer);
                }
            };
        } catch (error) {
            console.error("Error adding SourceBuffer:", error);
        }
    }

    useMemo(async () => {
        if (blobs.length && !isBackPressed && isTypeAACSupported && !isDownload) {
            const lastElement = blobs.slice(-1).pop();
            if (lastElement) {
                const buffer = await lastElement.arrayBuffer();
                setArrayBuffers((arrayBuffers) => arrayBuffers.concat(buffer));
            }
            return
        }
        setArrayBuffers([]);
    }, [blobs]);

    //appending audio to the media source to play it without blocking playback
    useMemo(() => {
        if (arrayBuffers.length > 0 && mediaSource.readyState === "open") {
            if (sourceBuffer.current && !sourceBuffer.current.updating) {
                try {
                    sourceBuffer.current.appendBuffer(arrayBuffers.shift() as ArrayBuffer);
                } catch (error) {
                    console.error("Error appending buffer:", error);
                }
            }

            if (!isPlaying && !isPaused) {
                seekAudio.playbackRate = playRate;
                seekAudio.volume = volume;
                seekAudio.play();
            }
        }
    }, [arrayBuffers]);

    // fallback if MediaSource does not support AAC on browsers,
    // but revoke old AAC URLs to free memory in AAC mode
    const playNext = useCallback(
        (index: number) => {
        if (isTypeAACSupported && seekAudio.src) {
            URL.revokeObjectURL(seekAudio.src);
        }
        seekAudio.src = audioUrls[index];
        seekAudio.id = (index + 1).toString();
        seekAudio.playbackRate = playRate;
        seekAudio.volume = volume;
        seekAudio.play();
        },
        [audioUrls, playRate, volume, isTypeAACSupported]
    );
    

    //initiating play
    useMemo(() => {
        if (isTypeAACSupported) return;
        if (audioUrls.length === 1 && !isDownload) {
            playNext(0);
        }

        //play new audio if presence modal is open and stream is processing after click on yes
        if (audioUrls.length > 1 && !isPromptingPaused && (wasPromptStopped === "PAUSED" || wasPromptStopped === "LOADING")) {
            //if audio paused after the 9th chunk (if prompting is to be pause every 9th), play next chunk (10th)
            setAudioLoading(false);
            if (isPaused) {
                setCurrentIndex(currentIndex + 1);
                playNext(currentIndex + 1);
                setTimeout(() => {
                    setWasPromptStopped("INIT");
                }, 500);
            }
        }
    }, [audioUrls]);

    useMemo(() => {
        if (isTypeAACSupported) return;
        if (isLoading && isStreamLoading) {
            setAudioUrlsBeforeStop(audioUrls.length);
        }
        if (!isLoading && isStreamLoading && audioUrlsBeforeStop < audioUrls.length && (audioUrls.length > currentIndex + 1)) {
            setCurrentIndex(currentIndex + 1);
            playNext(currentIndex + 1);
            setIsStreamLoading(false);
        }
    }, [isStreamLoading, isLoading, audioUrlsBeforeStop, audioUrls])

    // useMemo(() => {
    //         if (blobs.length > 0 && !hasCompletePlaying && !isDownload && !isTypeAACSupported) {
    //             const combinedBlob = new Blob(blobs, {
    //                 type: blobs[0]?.type || "audio/aac",
    //             });
    //             const combinedUrl = URL.createObjectURL(combinedBlob);
    //             seekAudio.src = combinedUrl;
    //             seekAudio.volume = volume;
    //             seekAudio.playbackRate = playRate;
    //             seekAudio.currentTime = currentTimeRef.current;
    //             if((isPlaying || !isPaused || partialChunkCompletedPlaying) || (!isPlaying && !isPaused)) seekAudio.play();
    //             setPartialChunkCompletedPlaying(false);
    //             // Create an object URL for the combined blob
    //         }
    // }, [blobs]);

    seekAudio.onloadedmetadata = () => {
        if (!isTypeAACSupported) {
            setPlayTimeDuration(seekAudio.duration);
        }
    };

    seekAudio.onprogress = () => {
        if (seekAudio.buffered.length > 0 && isTypeAACSupported) {
            const bufferedEnd = seekAudio.buffered.end(seekAudio.buffered.length - 1);
            setCurrentIndex(c => c + 1); //stores the current index of the audio that has been processed and appended to the SourceBuffer
            setPlayTimeDuration(bufferedEnd);
        }
    }

    seekAudio.ontimeupdate = () => {
        if (!isTypeAACSupported) setPartialChunkCompletedPlaying(false);
        if (isScrubbing.current) return;
        const current = seekAudio.currentTime;
        setCurrentPlayTime(current);
        currentTimeRef.current = current;
        // Logic for the are you still here pop-up for both firefox and chrome
        if (thresholdsRef.current[thresholdsRef.current.length - 1] !== playTimeDuration && playTimeDuration !== 0) {
            thresholdsRef.current.push(playTimeDuration);
        }
        const durations = thresholdsRef.current.filter(t => current >= t);
        if (isPromptingPaused && !isBackPressed && !triggeredThresholdsRef.current.has(durations[durations.length - 1])) {
            const chunkPlaying = durations.length;
            if (chunkPlaying % CHUNK_TO_PAUSE_ON === 0 && chunkPlaying < chunks.length && chunkPlaying !== 0 && !isPresenceModalOpen) {
                triggeredThresholdsRef.current.add(durations[durations.length - 1])
                setIsPresenceModalOpen(true);
            }
        }
    }

    seekAudio.onpause = () => {
        setIsPlaying(false);
        setIsPaused(true);
    };

    //controls loader state
    useMemo(() => {
        if (!isTypeAACSupported) return;
        const hasTimeCompleted = Math.round(currentPlayTime) === Math.round(playTimeDuration);
        const isLastChunk = currentIndex === chunks.length;
        setHasCompletePlaying(false);
        setPartialChunkCompletedPlaying(false);
        if (hasTimeCompleted && isLastChunk) return setHasCompletePlaying(true);
        if (hasTimeCompleted && !isLastChunk) return setPartialChunkCompletedPlaying(true);
    }, [currentPlayTime, playTimeDuration])

    //handles onplay event to set isPlaying and isPaused states
    seekAudio.onplay = () => {
        if (!isTypeAACSupported) setHasCompletePlaying(false); //reset hasCompletedPlaying to false on firefox if the audio is playing
        setIsPlaying(true);
        setIsPaused(false);
    };

    //does not get triggered with the current implementation of the audio player (MediaSource)
    //fallsback if MediaSource does not support AAC on browsers
    seekAudio.onended = () => {
        if (isTypeAACSupported) return;
        const nextIndexToPlay = currentIndex + 1;
        const handlePartialCompletion = () => {
            if (nextIndexToPlay === chunks.length) {
                return setHasCompletePlaying(true);
            }
            setPartialChunkCompletedPlaying(true);
        }

        if (isPromptingPaused) {
            //pause the audio on the current chunk if prompting is paused and the user has not click yes from the presence modal
            //ex: if the prompting is to be paused on every 9th chunk and the current chunk being played is the 9th chunk, the audio will be paused until the user clicks 
            //yes from the presence modal to continue from the 10th chunk
            if (nextIndexToPlay % CHUNK_TO_PAUSE_ON === 0 && audioUrls.length !== chunks.length) {
                pause();
                // handlePartialCompletion();
                return
            }
        }

        if (audioUrls.length > nextIndexToPlay) {
            setCurrentIndex(nextIndexToPlay);
            playNext(nextIndexToPlay);
        }

        if (isLoading && !isPlaying && (audioUrls.length === nextIndexToPlay || audioUrls.length < nextIndexToPlay)) {
            setIsStreamLoading(true);
        }
        handlePartialCompletion();
        //   return setPartialChunkCompletedPlaying(true);
    };

    const resetTimeout = () => {
        const timeoutId = localStorage.getItem("gptr/audio-timeout");
        if (timeoutId) {
            clearTimeout(parseInt(timeoutId));
            localStorage.removeItem("gptr/audio-timeout");
        }
    }

    const reset = useCallback((full: boolean = false, completeAudio?: boolean) => {
        // console.log("RESETTING");
        if (seekAudio) {
            seekAudio.pause();
            seekAudio.currentTime = 0;
        }
        setCurrentIndex(0);
        setCurrentPlayTime(0);
        setPlayTimeDuration(0);
        setIsPlaying(false);
        setIsPaused(false);
        setHasCompletePlaying(!!completeAudio);
        resetTimeout();
        endMediaStream();
        setIsPromptingPaused(false);
        thresholdsRef.current = [0];
        triggeredThresholdsRef.current.clear();
        setArrayBuffers([]);
        setCurrentIndex(0);
        setCurrentPlayTime(0);
        memoryWarnedRef.current = false;
        if (full) {
            seekAudio.src = "";
            resetAudioUrl();
        }
    }, [seekAudio, resetAudioUrl, isBackPressed])

    useMemo(() => {
        if (blobs.length && isBackPressed) {
            reset(true);
            setIsPresenceModalOpen(false);
        }
    }, [blobs, isBackPressed]);

    //adjust loading state when presence modal is open and stream is processing after clicking on yes
    //only works if the audio/aac is not supported
    useMemo(() => {
        //if user clicks on yes from presence modal and the audio was paused from the last chunk, 
        //set isStreamLoading to true to indicate buffering
        if (audioUrls.length > 1 && !isPromptingPaused && wasPromptStopped === "PAUSED" && !isTypeAACSupported) {
            setAudioLoading(true)
            setPartialChunkCompletedPlaying(true);
            setTimeout(() => {
                setWasPromptStopped("LOADING");
            }, 500);
        }
        if (!isPromptingPaused) setIsPresenceModalOpen(false);
    }, [isPromptingPaused, wasPromptStopped, audioUrls])

    const play = useCallback(() => {
        if (seekAudio) {
            seekAudio.play();
        }
    }, [seekAudio]);
  
  
    const pause = useCallback(() => {
        if (seekAudio) {
            seekAudio.pause();
        }
    }, [seekAudio]);


    const stop = useCallback(() => {
        if (seekAudio.src) {
            reset()
        }
    }, [seekAudio, reset])

    const replay = useCallback(async () => {
        if (!isTypeAACSupported) {
            setCurrentIndex(0)
            return playNext(0);
        }
        if (seekAudio) {
            seekAudio.currentTime = 0;
            play();
        }
    }, [seekAudio, play, reset]);

    const onScrub = useCallback((time: number) => {
        isScrubbing.current = true;
        const currentTime = (time * playTimeDuration) / 100;
        seekAudio.currentTime = currentTime;
        setCurrentPlayTime(currentTime);
        isScrubbing.current = false;
    }, [seekAudio, playTimeDuration]);

    const onForward = useCallback(() => {
        if (seekAudio) {
            const currentTime = seekAudio.currentTime;
            const increasedTime = currentTime + FORWARD_REWIND_TIME;
            const finalTime = increasedTime > playTimeDuration ? playTimeDuration - 0.5 : increasedTime;
            seekAudio.currentTime = finalTime;
        }
    }, [seekAudio, playTimeDuration]);

    const onRewind = useCallback(() => {
        if (seekAudio) {
            const currentTime = seekAudio.currentTime;
            const reducedTime = currentTime - FORWARD_REWIND_TIME;
            if (reducedTime < 0) return seekAudio.currentTime = 0;
            seekAudio.currentTime = reducedTime;
        }
    }, [seekAudio]);

    const handleVolumeChange = useCallback((volume: number, mute?: boolean) => {
        seekAudio.muted = !!mute;
        seekAudio.volume = volume;
        setVolume(volume);
    }, [seekAudio])

    //handler to toggle rate change from the play button
    const handlePlayRateChange = useCallback((reset?: boolean, rate?: number) => {
        if (rate) {
            setPlayRate(rate);
            return;
        }

        if (reset) {
            setPlayRate(1);
            return;
        }
        if (playRate === 2) {
            setPlayRate(0.5);
            return;
        }
        if (playRate < 0.5) {
            setPlayRate(0.5);
            return;
        }
        setPlayRate(playRate => playRate + PLAY_RATE_STEP);
    }, [playRate])

    //controls audio player rate
    useMemo(() => {
        seekAudio.playbackRate = playRate;
    }, [seekAudio, playRate])

    const checkForLoadingAfterNSeconds = () => {
        const isActive = localStorage.getItem("gptr/active") === "true";
        const isAudioLoading = localStorage.getItem("gptr/is-first-audio-loading") === "true";
        if (isActive && isAudioLoading) {
            const { id } = toast({ description: chrome.i18n.getMessage("slow_response_warning"), style: TOAST_STYLE_CONFIG });
            toast15SecRef.current = id;
        } else {
            if (toast15SecRef.current) dismiss(toast15SecRef.current);
        }
        localStorage.removeItem("gptr/is-first-audio-loading");
    }

    //clear timeout when downloading has progress
    useMemo(() => {
        if (isDownload && progress > 0 && timeoutId) {
            clearTimeout(timeoutId);
        }
    }, [isDownload, progress, timeoutId]);

    //checking loading state after 15 seconds of uploading text
    useEffect(() => {
        resetTimeout();
        if (text.trim().length) {
            const id = setTimeout(() => {
                checkForLoadingAfterNSeconds();
            }, isDownload ? LOADING_TIMEOUT_FOR_DOWNLOAD : LOADING_TIMEOUT);
            localStorage.setItem("gptr/audio-timeout", `${id}`);
            setTimeoutId(id)
        } else {
            if (timeoutId) clearTimeout(timeoutId);
        }
        return () => {
            if (timeoutId) clearTimeout(timeoutId);
            if (toast15SecRef.current) dismiss(toast15SecRef.current);
        }
    }, [text.trim().length, isDownload]);

    useEffect(() => {
        // only works in Chrome‐based browsers
        if (!(performance && (performance as any).memory)) return;
      
        const checkMemory = () => {
          const used = (performance as any).memory.usedJSHeapSize;
          const threshold = 425 * 1024 * 1024; // 425 MB
          if (!memoryWarnedRef.current && used > threshold) {
            toast({
              description: "Memory usage has exceeded 425 MB. GPT Reader recommends closing this tab and then clicking on the extension icon.",
              style: TOAST_STYLE_CONFIG,
            });
            memoryWarnedRef.current = true;
          }
        };
      
        // check every 15 seconds
        const id = setInterval(checkMemory, 15_000);
        return () => clearInterval(id);
      }, [toast]);

    const showInfoToast = (
        duration: number = 70000,
        description: string = chrome.i18n.getMessage("accuracy_warning")
    ) => {
        const { id } = toast({
            description,
            style: { ...TOAST_STYLE_CONFIG_INFO, fontWeight: "600" },
            duration,
        });
        infoToastIdRef.current = id;
    };

    useMemo(() => {
        if (blobs.length > 1 || isPlaying) {
            localStorage.removeItem("gptr/is-first-audio-loading");
            if (infoToastIdRef.current) dismiss(infoToastIdRef.current);
        }
    }, [blobs, isPlaying])

    useEffect(() => {
        if (chunks.length > 0 && !isDownload) {
            showInfoToast()
        }
        return () => {
            if (infoToastIdRef.current) dismiss(infoToastIdRef.current);
        }
    }, [chunks.length])

    return {
        isPlaying,
        isPaused,
        currentIndex,
        seekAudio,
        ended,
        text,
        isVoiceLoading,
        playRate,
        voices,
        isBackPressed,
        is9ThChunk,
        isFetching,
        volume,
        progress,
        isAuthenticated,
        partialChunkCompletedPlaying,
        currentPlayTime,
        playTimeDuration,
        isPromptingPaused,
        hasCompletePlaying,
        downloadPreviewText,
        isPresenceModalOpen,
        isLoading: isAudioLoading || isStreamLoading,
        pause,
        stop,
        play,
        replay,
        extractText,
        splitAndSendPrompt,
        reset,
        handlePlayRateChange,
        setVoices,
        setHasCompletePlaying,
        setIsBackPressed,
        reStartChunkProcess,
        setIs9thChunk,
        setAudioLoading,
        setIsPromptingPaused,
        setIsPresenceModalOpen,
        downloadCombinedFile,
        setProgress,
        onForward,
        onRewind,
        handleVolumeChange,
        onScrub,
        showInfoToast,
        isTypeAACSupported
    };


}
export default useAudioPlayer;