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
    // const [arrayBuffers, setArrayBuffers] = useState<ArrayBuffer[]>([]);
    const [isTypeAACSupported, setIsTypeAACSupported] = useState<boolean>(true);
    const [isStreamLoading, setIsStreamLoading] = useState<boolean>(false);
    const [audioUrlsBeforeStop, setAudioUrlsBeforeStop] = useState<number>(audioUrls.length);
    const memoryWarnedRef = useRef(false);

    const toast15SecRef = useRef<string | null>(null);
    const infoToastIdRef = useRef<string | null>(null);
    const currentTimeRef = useRef<number>(0);
    const bufferNum = useRef<number>(0);
    const isScrubbing = useRef<boolean>(false);
    const isPausedRef = useRef<boolean>(false); 

    const sourceBuffer = useRef<SourceBuffer | null>(null);
    const mediaSource = useMemo(() => new MediaSource(), [isBackPressed]);
    const seekAudio = useMemo(() => new Audio(URL.createObjectURL(mediaSource)), [mediaSource]);
    // ─── HYBRID FALLBACK SETUP ────────────────────────────────────────────────
    const MAX_HISTORY = 50;                                              // how many past chunks to keep
    const historyBuffersRef = useRef<ArrayBuffer[]>([]);                 // last N raw buffers
    const fallbackAudioRef  = useRef<HTMLAudioElement | null>(null); 
    // at top of useAudioPlayer
    const chunkBoundariesRef = useRef<Array<{chunkNumber: number; endTime: number}>>([]);
    /** Returns the 1-based chunk index containing time t */
    const getChunkAtTime = (t: number): number => {
        const bounds = chunkBoundariesRef.current;
        if (bounds.length === 0) return 1; // don't return 0 to avoid mod result being 0
        let lo = 0, hi = bounds.length - 1, mid: number, idx = bounds.length - 1;
        while (lo <= hi) {
            mid = (lo + hi) >> 1;
            if (t <= bounds[mid].endTime) {
                idx = mid;
                hi = mid - 1;
            } else {
                lo = mid + 1;
            }
        }
        return (bounds[idx]?.chunkNumber ?? 0) + 1;
    };

    const thresholdsRef = useRef<number[]>([0]);
    const triggeredThresholdsRef = useRef<Set<number>>(new Set());
    const bufferNumList = useRef<Set<number>>(new Set());
    const evictedSoFarRef = useRef<number>(0);
    const originalHistoryLengthRef = useRef<number>(0);
    const [pendingBuffers, setPendingBuffers] = useState<{ chunkNumber: number; buffer: ArrayBuffer }[]>([]);
    const playRateRef = useRef(playRate);
    const volumeRef   = useRef(volume);
    const pauseChunksRef = useRef<Set<number>>(new Set());
  
    //resetting the media source when the user clicks on the back button or onUnmount
    const endMediaStream = () => {
        if (sourceBuffer.current) {
            sourceBuffer.current.abort();
            sourceBuffer.current = null;
            try {
                if (!mediaSource || mediaSource.readyState !== "open") return;
                mediaSource.endOfStream();
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
            } catch (error) {}
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
        } catch (error) {
            console.error("Error initializing SourceBuffer:", error);
        }
    }

    useMemo(async () => {
        if (blobs.length && !isBackPressed && isTypeAACSupported && !isDownload) {
            const lastElement = blobs.slice(-1).pop();
            if (lastElement) {
                const buffer = await lastElement.blob.arrayBuffer();
                setPendingBuffers(pbs => {
                    if (pbs.some(entry => entry.chunkNumber === lastElement.chunkNumber)) {
                      return pbs;
                    }
                    return [...pbs, { chunkNumber: lastElement.chunkNumber, buffer }];
                  });
            }
            return;
        }
        setPendingBuffers([]);
    }, [blobs]);
    
    // watch for new buffers → try append (with quota-evict retry)
    useEffect(() => {
        if (
            !sourceBuffer.current ||
            sourceBuffer.current.updating ||
            mediaSource.readyState !== 'open' ||
            bufferNumList.current.has(bufferNum.current) || 
            bufferNum.current === chunks.length
        ) {
            return;
        }
        (async () => {
        while (true) {
            if (bufferNumList.current.has(bufferNum.current) || bufferNum.current === chunks.length) break;
            bufferNumList.current.add(bufferNum.current);
            const entry = pendingBuffers.find(x => x.chunkNumber === bufferNum.current);
            if (!entry) {
                bufferNumList.current.delete(bufferNum.current);
                break;
            } 
            const buf = entry.buffer;
            try {
                while (sourceBuffer.current!.updating) {
                    await new Promise<void>((resolve) => {
                      const onEnd = () => {
                        sourceBuffer.current!.removeEventListener("updateend", onEnd);
                        resolve();
                      };
                      sourceBuffer.current!.addEventListener("updateend", onEnd);
                    });
                }
                sourceBuffer.current!.appendBuffer(buf);
                setPendingBuffers(pbs =>
                    pbs.filter(x => x.chunkNumber !== bufferNum.current)
                );
                while (sourceBuffer.current!.updating) {
                    await new Promise<void>((resolve) => {
                      const onEnd = () => {
                        sourceBuffer.current!.removeEventListener("updateend", onEnd);
                        resolve();
                      };
                      sourceBuffer.current!.addEventListener("updateend", onEnd);
                    });
                }
                if (!historyBuffersRef.current.length) {
                    play();
                }
                bufferNum.current += 1;
                if (bufferNum.current % CHUNK_TO_PAUSE_ON === 0) {
                    setIsPromptingPaused(true);
                }
                // ─── RECORD FOR FALLBACK ────────────────────────────
                historyBuffersRef.current.push(buf);
                if (historyBuffersRef.current.length > MAX_HISTORY) {
                    historyBuffersRef.current.shift();
                }
                // *** decode the raw ArrayBuffer to get exact duration ***
                const audioCtx = new AudioContext();
                const decoded = await audioCtx.decodeAudioData(buf.slice(0));
                const dur = decoded.duration;
                audioCtx.close();

                // compute cumulative end time:
                const prevEnd = chunkBoundariesRef.current.length
                ? chunkBoundariesRef.current[chunkBoundariesRef.current.length - 1].endTime
                : 0;
                const newEnd = prevEnd + dur;

                // record it:
                chunkBoundariesRef.current.push({
                    chunkNumber: entry.chunkNumber,
                    endTime: newEnd,
                });

                // now you can set total duration:
                setPlayTimeDuration(newEnd);
            } catch (err: any) {
                bufferNumList.current.delete(bufferNum.current);
                if (!err.name?.includes("QuotaExceededError")) {
                    console.error("[APPEND] unexpected error", err);
                    break;
                }
                const nextEvict = Math.min(
                    evictedSoFarRef.current + 60,
                    currentTimeRef.current - 300
                );
                if (nextEvict <= evictedSoFarRef.current) {
                    await new Promise(r => setTimeout(r, 10_000));
                    continue;
                }
                
                sourceBuffer.current!.remove(0, nextEvict);
                evictedSoFarRef.current = nextEvict;
                while (sourceBuffer.current!.updating) {
                    await new Promise<void>((resolve) => {
                      const onEnd = () => {
                        sourceBuffer.current!.removeEventListener("updateend", onEnd);
                        resolve();
                      };
                      sourceBuffer.current!.addEventListener("updateend", onEnd);
                    });
                }
            }
        }
    
        if (!isPlaying && !isPaused) {
            play();
        }
        })();
    }, [pendingBuffers]);

      const playFallback = async (startTime: number) => {
        setIsPromptingPaused(true);
      
        // 1) wait for any in‐flight MSE updates to finish
        while (sourceBuffer.current!.updating) {
          await new Promise<void>((resolve) => {
            const onEnd = () => {
              sourceBuffer.current!.removeEventListener("updateend", onEnd);
              resolve();
            };
            sourceBuffer.current!.addEventListener("updateend", onEnd);
          });
        }
        
      
        // 3) pause the MSE‐driven audio
        seekAudio.pause();
      
        // 4) snapshot how many history buffers we have right now
        originalHistoryLengthRef.current = historyBuffersRef.current.length;
      
        // 5) build a blob URL from our history
        const blob = new Blob(historyBuffersRef.current, { type: "audio/aac" });
        const url = URL.createObjectURL(blob);
      
        // 6) revoke any previous fallback URL
        if (fallbackAudioRef.current) {
          URL.revokeObjectURL(fallbackAudioRef.current.src);
        }
      
        // 7) create the fallback <audio>
        const a = new Audio(url);
        a.currentTime = startTime;
        a.playbackRate = playRateRef.current;
        a.volume       = volumeRef.current;
      
        // 8) on each tick, first try to jump back to MSE if it’s caught up;
        //    otherwise, if our history grew, rebuild the blob in place
        a.ontimeupdate = () => {
          if (!fallbackAudioRef.current) return;
          const t = a.currentTime;
          setCurrentPlayTime(t);
          currentTimeRef.current = t;
      
          // check MSE buffer first
          const buf = seekAudio.buffered;
          for (let i = 0; i < buf.length; i++) {
            if (t >= buf.start(i) && t <= buf.end(i)) {
                // MSE can now serve this time → switch back
                if (isPromptingPaused && bufferNum.current !== 0 && (bufferNum.current % CHUNK_TO_PAUSE_ON !== 0 || (!isPresenceModalOpen && pauseChunksRef.current.has(bufferNum.current)))) {
                    reStartChunkProcess();
                }

                // tear down the fallback instance so it can’t accidentally play again
                a.pause();
                URL.revokeObjectURL(a.src);
                fallbackAudioRef.current = null;

                // jump into the MediaSource player directly
                seekAudio.currentTime = t;
                if (!isPausedRef.current) seekAudio.play();
                return;
            }
          }
      
          // else if we’ve recorded more history since we began fallback,
          // rebuild the blob under the hood so it “grows”
          if (historyBuffersRef.current.length > originalHistoryLengthRef.current) {
            const oldUrl = a.src;
            const newBlob = new Blob(historyBuffersRef.current, { type: "audio/aac" });
            const newUrl = URL.createObjectURL(newBlob);
            a.src = newUrl;
            a.currentTime = t;
            a.playbackRate = playRateRef.current;
            a.volume       = volumeRef.current;
            URL.revokeObjectURL(oldUrl);
            originalHistoryLengthRef.current = historyBuffersRef.current.length;
            if (!isPausedRef.current) a.play();
          }
        };
      
        // 9) remember this instance & kick it off
        fallbackAudioRef.current = a;
        if (!isPausedRef.current) {
          a.play();
        }
      };
      

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
        if (audioUrls.length > 1 && audioUrls.length % (CHUNK_TO_PAUSE_ON + 1) === 0 && !isPromptingPaused && (wasPromptStopped === "PAUSED" || wasPromptStopped === "LOADING")) {
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

    seekAudio.onloadedmetadata = () => {
        if (!isTypeAACSupported) {
            setPlayTimeDuration(seekAudio.duration);
        }
    };
   
    seekAudio.ontimeupdate = async () => {
      let paused = false;
      if (isTypeAACSupported) {
        const latestChunk = bufferNum.current;
        if (!isPromptingPaused && latestChunk % CHUNK_TO_PAUSE_ON === 0 && !pauseChunksRef.current.has(latestChunk) && latestChunk !== 0) {
            paused = true;
            setIsPromptingPaused(true);
        } 
        if ((isPromptingPaused || paused) && latestChunk !== 0 && (latestChunk % CHUNK_TO_PAUSE_ON !== 0 || (!isPresenceModalOpen && pauseChunksRef.current.has(latestChunk)))) reStartChunkProcess();
      }
      if (!isTypeAACSupported) setPartialChunkCompletedPlaying(false);
      if (isScrubbing.current) return;
      const current = seekAudio.currentTime;
      setCurrentPlayTime(current);
      currentTimeRef.current = current;

      const chunkPlaying = isTypeAACSupported ? (getChunkAtTime(current)) : +seekAudio.id;
      // Logic for the are you still here pop-up for both firefox and chrome
      if ((isPromptingPaused || paused) && !isBackPressed && !isPresenceModalOpen && (chunkPlaying % CHUNK_TO_PAUSE_ON === 0) && !pauseChunksRef.current.has(chunkPlaying) && chunkPlaying !== 0) {
          pauseChunksRef.current.add(chunkPlaying);
          setIsPresenceModalOpen(true);
      }
    }

    //controls loader state
    useMemo(() => {
        if (!isTypeAACSupported) return;
        const hasTimeCompleted = Math.round(currentPlayTime) === Math.round(playTimeDuration);
        const isLastChunk = getChunkAtTime(currentPlayTime) === chunks.length;
        setHasCompletePlaying(false);
        setPartialChunkCompletedPlaying(false);
        if (hasTimeCompleted && isLastChunk && !fallbackAudioRef.current) return setHasCompletePlaying(true);
        if (hasTimeCompleted && !isLastChunk) return setPartialChunkCompletedPlaying(true);
    }, [currentPlayTime, playTimeDuration])

    //handles onplay event to set isPlaying and isPaused states
    seekAudio.onplay = () => {
        if (!isTypeAACSupported) {
            setHasCompletePlaying(false);
            setIsPaused(false);
            setIsPlaying(true);
        }  //reset hasCompletedPlaying to false on firefox if the audio is playing
    };

    seekAudio.onpause = () => {
        if (!isTypeAACSupported) {
            setIsPaused(true);
            setIsPlaying(false);
        }
    }
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
        // delete the old ChatGPT conversation if we have one
        const storedChatId = window.location.href.match(/\/c\/([A-Za-z0-9\-_]+)/)?.[1];
        if (storedChatId) {
            // ask the page to send us back its accessToken
            window.dispatchEvent(new Event("GET_TOKEN"));

            // once we get it, do the PATCH
            const deleteHandler = (e: Event) => {
                const ce = e as CustomEvent<{ accessToken: string }>;
                const token = ce.detail.accessToken;
                if (token) {
                    fetch(
                        `https://chatgpt.com/backend-api/conversation/${storedChatId}`,
                        {
                            method: "PATCH",
                            headers: {
                                "Content-Type": "application/json",
                                "Authorization": `Bearer ${token}`,
                            },
                            body: JSON.stringify({ is_visible: false }),
                        }
                    ).catch(console.error);
                    const newChatBtn = document.querySelector<HTMLButtonElement>(
                      "[data-testid='create-new-chat-button'], [aria-label='New chat']"
                    );
                    if (newChatBtn) {
                      newChatBtn.click();
                    }
                }
                // clean up
                window.removeEventListener("AUTH_RECEIVED", deleteHandler);
            };

            window.addEventListener("AUTH_RECEIVED", deleteHandler, { once: true });
        }

        if (seekAudio) {
            seekAudio.pause();
            seekAudio.currentTime = 0;
        }
        if (fallbackAudioRef.current) {
            fallbackAudioRef.current.pause();
            URL.revokeObjectURL(fallbackAudioRef.current.src);
            fallbackAudioRef.current = null;
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
        setPendingBuffers([]);
        setCurrentPlayTime(0);
        memoryWarnedRef.current = false;
        evictedSoFarRef.current = 0;
        bufferNum.current = 0;
        bufferNumList.current.clear();
        historyBuffersRef.current = [];
        fallbackAudioRef.current = null;
        originalHistoryLengthRef.current = 0;
        isPausedRef.current = false;
        chunkBoundariesRef.current = [];
        pauseChunksRef.current.clear();
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
        isPausedRef.current = false;
        setIsPlaying(true);
        setIsPaused(false);
        if (fallbackAudioRef.current) {
          fallbackAudioRef.current.play();
        } else {
          seekAudio.play();
        }
      }, [seekAudio]);
      
  
      const pause = useCallback(() => {
        isPausedRef.current = true;
        setIsPlaying(false);
        setIsPaused(true);
        if (fallbackAudioRef.current) {
          fallbackAudioRef.current.pause();
        } else {
          seekAudio.pause();
        }
      }, [seekAudio]);
      


      const stop = useCallback(() => {
        if (fallbackAudioRef.current) {
          fallbackAudioRef.current.pause();
          URL.revokeObjectURL(fallbackAudioRef.current.src);
          fallbackAudioRef.current = null;
        } else {
          seekAudio.pause();
          seekAudio.currentTime = 0;
          endMediaStream();
        }
      }, [seekAudio, reset]);
      

      const replay = useCallback(() => {
        if (!isTypeAACSupported) {
          setCurrentIndex(0);
          return playNext(0);
        }
        const t0 = 0;
        // 1) check whether MSE has buffered past t0
        const buf = seekAudio.buffered;
        let mseHasZero = false;
        for (let i = 0; i < buf.length; i++) {
          if (t0 >= buf.start(i) && t0 <= buf.end(i)) {
            mseHasZero = true;
            break;
          }
        }
      
        if (mseHasZero) {
          // — use the main MSE-driven player —
          // tear down any lingering fallback
          if (fallbackAudioRef.current) {
            fallbackAudioRef.current.pause();
            URL.revokeObjectURL(fallbackAudioRef.current.src);
            fallbackAudioRef.current = null;
          }
          seekAudio.currentTime = t0;
          seekAudio.play();
        } else {
          // — rebuild & use the fallback blob player —
          playFallback(t0);
        }
      }, [seekAudio, playFallback]);
      

    // ─── SCRUB / SEEK handler (hybrid MSE + blob-fallback) ─────────────────
    const onScrub = useCallback((percent: number) => {
        isScrubbing.current = true;
        const seekTime = (percent * playTimeDuration) / 100;

        // 1) inspect actual buffered ranges
        const buffered = seekAudio.buffered;
        let inBuffer = false;
        for (let i = 0; i < buffered.length; i++) {
            if (seekTime >= buffered.start(i) && seekTime <= buffered.end(i)) {
                inBuffer = true;
                break;
            }
        }
        
        if (inBuffer) {
            // still in MSE buffer → normal HTMLMediaElement seek
            if (isPromptingPaused && bufferNum.current !== 0 && (bufferNum.current % CHUNK_TO_PAUSE_ON !== 0 || (!isPresenceModalOpen && pauseChunksRef.current.has(bufferNum.current)))) reStartChunkProcess();
            if (fallbackAudioRef.current) {
                fallbackAudioRef.current.pause();
                URL.revokeObjectURL(fallbackAudioRef.current.src);
                fallbackAudioRef.current = null;
            }
            seekAudio.currentTime = seekTime;
            if (!isPausedRef.current) seekAudio.play();
        } else {
            setIsPromptingPaused(true);
            seekAudio.pause();
            if (fallbackAudioRef.current) {
                // already in fallback → just seek that instance
                fallbackAudioRef.current.currentTime = seekTime;
                if (!isPausedRef.current) fallbackAudioRef.current.play();
              } else {
                // first time outside buffer → spin up fallback
                playFallback(seekTime);
              }
        }

        setCurrentPlayTime(seekTime);
        currentTimeRef.current = seekTime;
        isScrubbing.current = false;
    }, [playTimeDuration, seekAudio]);


    const onForward = useCallback(() => {
        const delta = FORWARD_REWIND_TIME;
        // 1) figure out our current play head
        const current = fallbackAudioRef.current
          ? fallbackAudioRef.current.currentTime
          : seekAudio.currentTime;
      
        // 2) compute desired seek position (clamped to total duration)
        const desired = Math.min(current + delta, playTimeDuration);
      
        // 3) scan MSE buffered ranges
        let inMse = false;
        const buf = seekAudio.buffered;
        for (let i = 0; i < buf.length; i++) {
          if (desired >= buf.start(i) && desired <= buf.end(i)) {
            inMse = true;
            break;
          }
        }
      
        if (inMse) {
          // ── it’s in MSE: tear down any blob fallback and jump into the main player
          if (isPromptingPaused && bufferNum.current !== 0 && (bufferNum.current % CHUNK_TO_PAUSE_ON !== 0 || (!isPresenceModalOpen && pauseChunksRef.current.has(bufferNum.current)))) reStartChunkProcess();
          if (fallbackAudioRef.current) {
            fallbackAudioRef.current.pause();
            URL.revokeObjectURL(fallbackAudioRef.current.src);
            fallbackAudioRef.current = null;
          }
          seekAudio.currentTime = desired;
          if (!isPausedRef.current) seekAudio.play();
        } else {
          // ── it’s outside MSE: use or spin up the blob fallback
          setIsPromptingPaused(true); 
          if (fallbackAudioRef.current) {
            fallbackAudioRef.current.currentTime = desired;
            if (!isPausedRef.current) fallbackAudioRef.current.play();
          } else {
            playFallback(desired);
          }
        }
        setCurrentPlayTime(desired);
        currentTimeRef.current = desired;
      }, [seekAudio, playTimeDuration, playFallback]);
      
      

      const onRewind = useCallback(() => {
        const delta = FORWARD_REWIND_TIME;
      
        // 1) figure out our current play head (prefer fallback if active)
        const current = fallbackAudioRef.current
          ? fallbackAudioRef.current.currentTime
          : seekAudio.currentTime;
      
        // 2) compute desired rewind position (clamp ≥ 0)
        const desired = Math.max(current - delta, 0);
      
        // 3) check if desired time now lies within any MSE buffered range
        let inMSE = false;
        const buf = seekAudio.buffered;
        for (let i = 0; i < buf.length; i++) {
          if (desired >= buf.start(i) && desired <= buf.end(i)) {
            inMSE = true;
            break;
          }
        }
      
        if (inMSE) {
          // ── if we can serve it from MSE, tear down any blob fallback and jump back
          if (fallbackAudioRef.current) {
            fallbackAudioRef.current.pause();
            URL.revokeObjectURL(fallbackAudioRef.current.src);
            fallbackAudioRef.current = null;
          }
          seekAudio.currentTime = desired;
          if (!isPausedRef.current) seekAudio.play();
        } else {
          // ── otherwise it lives in the fallback blob history
          setIsPromptingPaused(true);
          if (fallbackAudioRef.current) {
            fallbackAudioRef.current.currentTime = desired;
            if (!isPausedRef.current) fallbackAudioRef.current.play();
          } else {
            playFallback(desired);
          }
        }
        setCurrentPlayTime(desired);
        currentTimeRef.current = desired;
      }, [seekAudio, playFallback]);
      
      
      

    const handleVolumeChange = useCallback((volume: number, mute?: boolean) => {
        seekAudio.muted = !!mute;
        seekAudio.volume = volume;
        if (fallbackAudioRef.current) {
            fallbackAudioRef.current.volume = volume;
            fallbackAudioRef.current.muted = !!mute;
        }
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

    // controls audio player rate
    useEffect(() => {
        seekAudio.playbackRate = playRate;
        if (fallbackAudioRef.current) {
            fallbackAudioRef.current.playbackRate = playRate;
        }
        playRateRef.current = playRate;
    }, [seekAudio, playRate]);

    // whenever our `volume` state changes, push it into both players
    useEffect(() => {
        seekAudio.volume = volume;      // or however you track mute
        if (fallbackAudioRef.current) {
            fallbackAudioRef.current.volume = volume;
        }
        volumeRef.current = volume;
    }, [volume, seekAudio]);

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