import { PLAY_RATE_STEP, TOAST_STYLE_CONFIG } from "@/lib/constants";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import useAudioUrl from "./use-audio-url";
import useAuthToken from "./use-auth-token";

const useAudioPlayer = () => {
    const { audioUrls, ended, extractText, splitAndSendPrompt, text, reset: resetAudioUrl, voices, setVoices } = useAudioUrl();
    const { isAuthenticated, token } = useAuthToken();
    const [isPlaying, setIsPlaying] = useState<boolean>(false);
    const [isPaused, setIsPaused] = useState<boolean>(false);
    const [isAudioLoading, setAudioLoading] = useState<boolean>(false);
    const [currentIndex, setCurrentIndex] = useState<number>(0)
    const [playRate, setPlayRate] = useState<number>(1);
    const audioPlayer = useMemo(() => new Audio(), []);

    const fetchAndDecodeAudio = useCallback(async (url: string) => {
        // setIsLoading(true);
        setAudioLoading(true);
        const response = await fetch(url, { headers: { "authorization": `Bearer ${token}` } });
        if (response.status !== 200) {
            throw new Error(response.statusText);
        }
        const blob = await response.blob();
        const audioUrl = URL.createObjectURL(blob);
        // setIsLoading(false);
        setAudioLoading(false)
        return audioUrl;
    }, [token])

    const playNext = useCallback(async (index: number) => {
        try {
            if (token) {
                const url = await fetchAndDecodeAudio(audioUrls[index]);
                audioPlayer.src = url;
                audioPlayer.playbackRate = playRate;
                audioPlayer.play();
                setIsPlaying(true);
                setIsPaused(false);
            }
        } catch (e) {
            const error = e as Error;
            toast.error(error.message, { duration: 10000, position: "top-center", dismissible: true, style: TOAST_STYLE_CONFIG });
        }
    }, [token, fetchAndDecodeAudio, audioUrls, audioPlayer, playRate])

    const reset = useCallback((full: boolean = false) => {
        console.log("RESETTING");
        audioPlayer.pause();
        audioPlayer.currentTime = 0;
        setCurrentIndex(0);
        setIsPlaying(false);
        setIsPaused(false);
        if (full) {
            audioPlayer.src = "";
            resetAudioUrl();
            audioPlayer.removeEventListener("ended", () => { });
        }
    }, [audioPlayer, resetAudioUrl])

    const handleAudioEnd = useCallback(() => {
        console.log("HANDLE_AUDIO_END");
        const current = currentIndex + 1;
        if (currentIndex === audioUrls.length - 1) {
            return reset();
        }
        setCurrentIndex(current);
        playNext(current);
    }, [currentIndex, playNext, audioUrls.length, reset])

    const pause = () => {
        if (isPlaying && audioPlayer.src) {
            audioPlayer.pause();
            setIsPlaying(false);
            setIsPaused(true);
        }
    }

    const stop = useCallback(() => {
        if (audioPlayer.src) {
            reset()
        }
    }, [audioPlayer, reset])

    const play = useCallback(() => {
        if (!isPlaying) {
            //plays from start if currentIndex is 0
            if (currentIndex === 0) {
                return playNext(0);
            }
            audioPlayer.play();
            setIsPlaying(true);
            setIsPaused(false);
        }
    }, [audioPlayer, isPlaying, currentIndex])

    //handler to toggle rate change from the play button
    const handlePlayRateChange = useCallback(() => {
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

    useEffect(() => {
        audioPlayer.addEventListener("ended", handleAudioEnd);
        return () => {
            audioPlayer.removeEventListener("ended", handleAudioEnd);
        }
    }, [audioPlayer, handleAudioEnd]);

    useMemo(() => {
        setAudioLoading(audioUrls.length === 0); //initial loading state if the first chunk is being prompted and not playing
        if (audioUrls.length === 1) {
            console.log("INIT PLAY")
            playNext(0)
        }
    }, [audioUrls.length]);

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
        isLoading: isAudioLoading,
        reset,
        playRate,
        handlePlayRateChange,
        voices,
        setVoices
    }


}
export default useAudioPlayer;