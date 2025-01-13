import { CHUNK_TO_PAUSE_ON, LISTENERS, PLAY_RATE_STEP, TOAST_STYLE_CONFIG } from "@/lib/constants";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import useAudioUrl from "./use-audio-url";
import useAuthToken from "./use-auth-token";
import { useToast } from "./use-toast";

const useAudioPlayer = () => {
    const { toast, dismiss } = useToast();
    const { wasPromptStopped, setWasPromptStopped, chunks, setIsPromptingPaused, isPromptingPaused, audioUrls, setAudioUrls, ended, extractText, splitAndSendPrompt, text, reset: resetAudioUrl, voices, setVoices, isVoiceLoading, is9ThChunk, reStartChunkProcess, setIs9thChunk, isLoading } = useAudioUrl();
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
    const [isPresenceModalOpen, setIsPresenceModalOpen] = useState<boolean>(false);
    const [audioUrlsBeforeStop, setAudioUrlsBeforeStop] = useState<number>(audioUrls.length);
    const toast15SecRef = useRef<string | null>(null);

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
        if (audioUrls.length > 0 && (audioUrls.length === completedPlaying.length) && !isLoading && chunks.length === audioUrls.length) {
                console.log("PLAYER COMPLETED ALL CHUNKS");
                setHasCompletePlaying(true);
                setAudioUrls(completedPlaying);
                audioPlayer.src = completedPlaying[0];
                audioPlayer.id = "1";
                // audioPlayer.pause();
                
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
                audioPlayer.id = (index + 1).toString();
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

    const reset = useCallback((full: boolean = false, completeAudio?: boolean) => {
        console.log("RESETTING");
        audioPlayer.pause();
        audioPlayer.currentTime = 0;
        setCurrentIndex(0);
        setIsPlaying(false);
        setIsPaused(false);
        setHasCompletePlaying(!!completeAudio);
        if (full) {
            audioPlayer.src = "";
            resetAudioUrl();
            audioPlayer.removeEventListener("ended", () => { });
        }
    }, [audioPlayer, resetAudioUrl, isBackPressed])

    //show the presence modal if the audio currently being played is from the chunk that we are pausing the processing on
    useMemo(() => {
        if(isPromptingPaused){
            // if(currentIndex > 0 && currentIndex % CHUNK_TO_PAUSE_ON === CHUNK_TO_PAUSE_ON - 1){
            //     setIsPresenceModalOpen(true);
            // }
            const chunkPlaying = +audioPlayer.id;
            if(chunkPlaying % CHUNK_TO_PAUSE_ON===0){
                setTimeout(()=>setIsPresenceModalOpen(true), 1000); //delay 1 sec to allow the audio to play for a sec
            }
        }
    }, [isPromptingPaused, currentIndex])

    const markCompleted=(url: string)=>{
        const tempComp = [...completedPlaying];
        tempComp.push(url)
        setCompletedPlaying(tempComp);
    }

    const handleAudioEnd = useCallback(async () => {
        console.log("HANDLE_AUDIO_END");
        const current = currentIndex + 1;
        
        if (isPromptingPaused) {
            //pause the audio on the current chunk if prompting is paused and the user has not click yes from the presence modal
            //ex: if the prompting is to be paused on every 9th chunk and the current chunk being played is the 9th chunk, the audio will be paused until the user clicks 
            //yes from the presence modal to continue from the 10th chunk
            if (current % CHUNK_TO_PAUSE_ON === 0 && audioUrls.length !== chunks.length) {
                pause();
                return
            }
        }

        markCompleted(audioPlayer.src)
        
        if (currentIndex === audioUrls.length - 1 && !isLoading) {
            return reset(false, true);
        }
        
        if(audioUrls.length > current){
            setCurrentIndex(current);
            playNext(current);
        }
        if(isLoading && !isPlaying && audioUrls.length === current) setIsStreamLoading(true);
    }, [currentIndex, playNext, audioUrls.length, reset, isPromptingPaused, isLoading, chunks])

    useMemo(()=>{
        if(isLoading && isStreamLoading){
            setAudioUrlsBeforeStop(audioUrls.length);
        }
        if(!isLoading && isStreamLoading && audioUrlsBeforeStop < audioUrls.length){
            setCurrentIndex(currentIndex+1);
            playNext(currentIndex+1);
            setIsStreamLoading(false);
        }
    },[isStreamLoading, isLoading, audioUrlsBeforeStop, audioUrls])

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
        const isActive = localStorage.getItem("gptr/active") === "true";
        if (isLoading && isActive) {
           const { id } = toast({ description: "ChatGPT seems to be taking too long, please close this overlay for the exact error message or refresh the page and try again.", style: TOAST_STYLE_CONFIG }); 
           toast15SecRef.current = id;
        }else{
            if(toast15SecRef.current) dismiss(toast15SecRef.current);
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

        //play new audio if presence modal is open and stream is processing after click on yes
        if(audioUrls.length > 1 && !isPromptingPaused && wasPromptStopped){
            //if audio paused after the 9th chunk (if prompting is to be pause every 9th), play next chunk (10th)
            if(isPaused){
                markCompleted(audioPlayer.src)
                setCurrentIndex(currentIndex + 1);
                playNext(currentIndex + 1);
                setTimeout(()=>{
                    setWasPromptStopped(false);
                },  500);
            }
        }

    }, [audioUrls.length, isBackPressed]);

    //adjust loading state when presence modal is open and stream is processing after clicking on yes
    useMemo(()=>{
        //if user clicks on yes from presence modal and the audio was paused from the last chunk, 
        //set isStreamLoading to true to indicate buffering
        if(audioUrls.length > 1 && !isPromptingPaused && wasPromptStopped){
            setAudioLoading(isLoading && isPaused);
            setTimeout(()=>{
                setWasPromptStopped(false);
            },  500);
        }
        if(!isPromptingPaused) setIsPresenceModalOpen(false);
    },[isPromptingPaused,isLoading, isPaused, wasPromptStopped])

    //checking loading state after 15 seconds of uploading text
    useEffect(() => {
        if (text.trim().length) {
            const id = setTimeout(() => {
                checkForLoadingAfter15Seconds();
            }, 15000);
            setTimeoutId(id)
        } else {
            if(timeoutId) clearTimeout(timeoutId);
        }
        return () => {
            if(timeoutId) clearTimeout(timeoutId);
            if(toast15SecRef.current) dismiss(toast15SecRef.current);
        }
    }, [text.trim().length]);

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
        setAudioLoading,
        setIsPromptingPaused, isPromptingPaused,
        isPresenceModalOpen,
        setIsPresenceModalOpen
    }


}
export default useAudioPlayer;