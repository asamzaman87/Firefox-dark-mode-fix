import { CHUNK_TO_PAUSE_ON, LISTENERS, PLAY_RATE_STEP, TOAST_STYLE_CONFIG } from "@/lib/constants";
import { useCallback, useEffect, useMemo, useState } from "react";
import useAudioUrl from "./use-audio-url";
import useAuthToken from "./use-auth-token";
import { useToast } from "./use-toast";

const useAudioPlayer = () => {
    const { toast } = useToast();
    const { audioUrls, setAudioUrls, ended, extractText, splitAndSendPrompt, text, reset: resetAudioUrl, voices, setVoices, isVoiceLoading, is9ThChunk, reStartChunkProcess, setIs9thChunk, isLoading } = useAudioUrl();
    const { isAuthenticated, token } = useAuthToken();
    const [isPlaying, setIsPlaying] = useState<boolean>(false);
    const [isPaused, setIsPaused] = useState<boolean>(false);
    const [isAudioLoading, setAudioLoading] = useState<boolean>(false);
    const [hasCompletePlaying, setHasCompletePlaying] = useState<boolean>(false);
    const [currentIndex, setCurrentIndex] = useState<number>(0)
    const [playRate, setPlayRate] = useState<number>(1);
    const [completedPlaying, setCompletedPlaying] = useState<string[]>([]);
    const [isBackPressed, setIsBackPressed] = useState<boolean>(false);
    const [timeoutId, setTimeoutId] = useState<NodeJS.Timeout | null>(null);
    const [isStreamLoading, setIsStreamLoading] = useState<boolean>(false);

    const audioPlayer = useMemo(() => new Audio(), []);

    //handles onpause event to set isPlaying and isPaused states
    audioPlayer.onpause = () => {
        setIsPlaying(false);
        setIsPaused(true);
    }

    //handles onplay event to set isPlaying and isPaused states
    audioPlayer.onplay = () => {
        setIsPlaying(true);
        setIsPaused(false);
    }

    useMemo(() => {
        if (audioUrls.length > 0 && (audioUrls.length === completedPlaying.length)) {
            console.log("PLAYER COMPLETED ALL CHUNKS")
            setAudioUrls(completedPlaying);
            setHasCompletePlaying(true);
            audioPlayer.src = completedPlaying[0];

            //delayed to allow src to be set
            setTimeout(() => {
                setCompletedPlaying([]);
            }, 200);
        }
    }, [completedPlaying]);

    const playNext = useCallback(async (index: number) => {
        try {
            if (token) {
                audioPlayer.src = audioUrls[index];
                audioPlayer.playbackRate = playRate;
                audioPlayer.play();
                setIsPlaying(true);
                setIsPaused(false);
            }
        } catch (e) {
            const error = e as Error;
            toast({ description: "Something went wrong!" + "\n" + JSON.stringify(error), style: TOAST_STYLE_CONFIG });
        }
    }, [token, audioUrls, audioPlayer, playRate])

    const reset = useCallback((full: boolean = false) => {
        console.log("RESETTING");
        audioPlayer.pause();
        audioPlayer.currentTime = 0;
        setCurrentIndex(0);
        setIsPlaying(false);
        setIsPaused(false);
        setHasCompletePlaying(false);
        if (full) {
            audioPlayer.src = "";
            resetAudioUrl();
            audioPlayer.removeEventListener("ended", () => { });
        }
    }, [audioPlayer, resetAudioUrl, isBackPressed])

    const handleAudioEnd = useCallback(() => {
        console.log("HANDLE_AUDIO_END");
        if (is9ThChunk) {
            pause()
            return
        }

        setCompletedPlaying(p => [...p, audioPlayer.src])
        const current = currentIndex + 1;

        //set loading true if no audio urls present but a chunk is still being processed
        if (currentIndex === audioUrls.length - 1 && isLoading) { 
            setIsStreamLoading(true);
            return ;
        }

        setIsStreamLoading(false);

        if (currentIndex === audioUrls.length - 1 && !isLoading) { //!isLoading to prevent resetting if there is a chunk still loading.
            return reset();
        }
        
        setCurrentIndex(current);
        playNext(current);
    }, [currentIndex, playNext, audioUrls.length, reset])

    const pause = () => {
        if (isPlaying && audioPlayer.src) {
            audioPlayer.pause();
        }
    }

    const stop = useCallback(() => {
        if (audioPlayer.src) {
            reset()
        }
    }, [audioPlayer, reset])

    const play = useCallback(() => {
        if (!isPlaying) {
            audioPlayer.playbackRate = playRate;
            audioPlayer.play();
        }
    }, [audioPlayer, isPlaying, currentIndex, playRate])

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
        audioPlayer.playbackRate = playRate;
    }, [audioPlayer, playRate])

    //check for network connection via navigator
    const updateConnectionStatus = () => {
        if (!navigator.onLine) {
            toast({ description: "You seem to be offline! Please check your network connection and try again!", style: TOAST_STYLE_CONFIG });
        }
    }

    useEffect(() => {
        audioPlayer.addEventListener(LISTENERS.AUDIO_ENDED, handleAudioEnd);
        window.addEventListener('online', updateConnectionStatus);
        window.addEventListener('offline', updateConnectionStatus);
        return () => {
            audioPlayer.removeEventListener(LISTENERS.AUDIO_ENDED, handleAudioEnd);
            window.removeEventListener('online', updateConnectionStatus);
            window.removeEventListener('offline', updateConnectionStatus);
        }
    }, [audioPlayer, handleAudioEnd]);

    const checkForLoadingAfter15Seconds = () => {
        const isLoading = localStorage.getItem("gptr/audio-loading") === "true";
        if (isLoading) {
            toast({ description: "ChatGPT seems to be taking too long, please close this overlay for the exact error message or refresh the page and try again.", style: TOAST_STYLE_CONFIG });
        }
        localStorage.removeItem("gptr/audio-loading");
    }

    useMemo(() => {
        //resetting audio url if back pressed as the synthesize api might return a delayed response after back press while a chunk had called it
        if (audioUrls.length && isBackPressed) {
            return reset(true);
        }

        setAudioLoading(audioUrls.length === 0); //initial loading state if the first chunk is being prompted and not playing
        localStorage.setItem("gptr/audio-loading", String(audioUrls.length === 0));

        if (audioUrls.length === 1) {
            setCompletedPlaying([]);
            console.log("INIT PLAY")
            playNext(0)
        }

        //if audioUrls.length is divisible by CHUNK_TO_PAUSE_ON, then it means that the CHUNK_TO_PAUSE_ON has been played and the player should be paused from prompting further
        if (audioUrls?.length && audioUrls.length % CHUNK_TO_PAUSE_ON === 0) {
            setCompletedPlaying(p => [...p, audioPlayer.src])
            playNext((audioUrls.length - 1))
            setIs9thChunk(false)
        }

    }, [audioUrls.length, isBackPressed]);

    //checking loading state after 15 seconds of uploading text
    useEffect(() => {
        if (text.trim().length) {
            const id = setTimeout(() => {
                checkForLoadingAfter15Seconds();
            }, 15000);
            setTimeoutId(id)
        } else {
            timeoutId && clearTimeout(timeoutId);
        }
        return () => {
            timeoutId && clearTimeout(timeoutId);
        }
    }, [text.trim().length]);

    //setting audio loading state to true if the current chunk is the 9th chunk and user presses Yes to continue
    useEffect(() => {
        is9ThChunk && setAudioLoading(is9ThChunk && isLoading);
    }, [isLoading]);

    return {
        isAuthenticated,
        isPlaying,
        isPaused,
        pause,
        stop,
        play,
        currentIndex,
        audioPlayer,
        playNext,
        extractText,
        splitAndSendPrompt,
        ended,
        text,
        isStreamLoading,
        isLoading: isAudioLoading,
        isVoiceLoading,
        reset,
        playRate,
        handlePlayRateChange,
        voices,
        setVoices,
        hasCompletePlaying,
        setHasCompletePlaying,
        isBackPressed,
        setIsBackPressed,
        is9ThChunk,
        reStartChunkProcess,
        setIs9thChunk,
        setAudioLoading
    }


}
export default useAudioPlayer;