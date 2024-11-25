import { LISTENERS, PLAY_RATE_STEP, TOAST_STYLE_CONFIG } from "@/lib/constants";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import useAudioUrl from "./use-audio-url";
import useAuthToken from "./use-auth-token";

const useAudioPlayer = () => {
    const { audioUrls, setAudioUrls, ended, extractText, splitAndSendPrompt, text, reset: resetAudioUrl, voices, setVoices } = useAudioUrl();
    const { isAuthenticated, token } = useAuthToken();
    const [isPlaying, setIsPlaying] = useState<boolean>(false);
    const [isPaused, setIsPaused] = useState<boolean>(false);
    const [isAudioLoading, setAudioLoading] = useState<boolean>(false);
    const [hasCompletePlaying, setHasCompletePlaying] = useState<boolean>(false);
    const [currentIndex, setCurrentIndex] = useState<number>(0)
    const [playRate, setPlayRate] = useState<number>(1);
    const [completedPlaying, setCompletedPlaying] = useState<string[]>([]);
    const [isBackPressed, setIsBackPressed] = useState<boolean>(false);
    const audioPlayer = useMemo(() => new Audio(), [isBackPressed]);

    useMemo(()=>{
        if(audioUrls.length > 0 && (audioUrls.length === completedPlaying.length)){
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
            toast.error("Something went wrong!"+"\n"+JSON.stringify(error), { duration: 10000, dismissible: true, style: TOAST_STYLE_CONFIG });
        }
    }, [token, audioUrls, audioPlayer, playRate])

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
        setCompletedPlaying(p=>[...p, audioPlayer.src])
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
            audioPlayer.playbackRate = playRate;
            audioPlayer.play();
            setIsPlaying(true);
            setIsPaused(false);
        }
    }, [audioPlayer, isPlaying, currentIndex, playRate])

    //handler to toggle rate change from the play button
    const handlePlayRateChange = useCallback((reset?: boolean) => {
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

    useEffect(() => {
        audioPlayer.addEventListener(LISTENERS.AUDIO_ENDED, handleAudioEnd);
        return () => {
            audioPlayer.removeEventListener(LISTENERS.AUDIO_ENDED, handleAudioEnd);
        }
    }, [audioPlayer, handleAudioEnd]);

    useMemo(() => {
        //resetting audio url if back pressed as the synthesize api might return a delayed response after back press while a chunk had called it
        if(audioUrls.length && isBackPressed) {
            return resetAudioUrl();
        }

        setAudioLoading(audioUrls.length === 0); //initial loading state if the first chunk is being prompted and not playing
        
        if (audioUrls.length === 1) {
            setCompletedPlaying([]);
            console.log("INIT PLAY")
            playNext(0)
        }
    }, [audioUrls.length, isBackPressed]);

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
        setVoices,
        hasCompletePlaying,
        setHasCompletePlaying,
        isBackPressed,
        setIsBackPressed
    }


}
export default useAudioPlayer;