import { AUDIO_FORMAT, LISTENERS, SYNTETHIZE_ENDPOINT, TOAST_STYLE_CONFIG, VOICE } from "@/lib/constants";
import { extractChunkNumberFromPrompt } from "@/lib/utils";
import { useCallback, useEffect, useRef, useState } from "react";
import useAuthToken from "./use-auth-token";
import { useToast } from "./use-toast";
import useVoice from "./use-voice";

const useStreamListener = (setIsLoading: (state: boolean) => void) => {
    const { toast } = useToast();
    const [completedStreams, setCompletedStreams] = useState<string[]>([]);
    const [currentCompletedStream, setCurrentCompletedStream] = useState<{ messageId: string, conversationId: string, createTime: number, text: string, chunkNumber: string } | null>(null);
    const [error, setError] = useState<string | null>(null);
    const { token } = useAuthToken();
    const { voices, handleVoiceChange, isLoading: isVoiceLoading } = useVoice();
    const retryCount = useRef<number>(0);

    const setVoices = (voice: string) => {
        handleVoiceChange(voice);
    }

    const handleError = (error: string) => {
        toast({ description:error, style: TOAST_STYLE_CONFIG });
        return
    }

    const fetchAndDecodeAudio = useCallback(async (url: string) => {
        const response = await fetch(url, { headers: { "authorization": `Bearer ${token}` } });
        if (response.status !== 200) {
            if(response.status === 429){
                //console.log(response.status);
                handleError("You have exceeded the hourly limit for your current ChatGPT model. Please switch to another model to continue using GPT Reader or wait an hour.");
                return
            }
            if(response.status === 403 || response.status === 404 || response.status === 503){
                if(retryCount.current !== 0){
                    handleError("ChatGPT seems to be having issues finding the audio, please click the back button on the top-left or close the overlay and try again.");
                    return
                }
                //retry fetching audio if 403 or 404 is returned
                return retry(url);
            }
            handleError("ChatGPT seems to be having issues, please close this overlay for the exact error message.");
        }
        const blob = await response.blob();
        const audioUrl = URL.createObjectURL(blob);
        return audioUrl;
    }, [token])

    //retry fetching audio
    const retry = useCallback(async (url: string): Promise<string | undefined> => {
        retryCount.current++
        return await fetchAndDecodeAudio(url);
    },[retryCount, token])

    const handleConvStream = useCallback(async(e: Event) => {
        const { detail: { messageId, conversationId, text, createTime } } = e as Event & { detail: { conversationId: string, messageId: string, createTime: number, text: string } };
        const chunkNumber = extractChunkNumberFromPrompt(text);
        if (chunkNumber) {
            if(token){
                try{
                    // prefetching audio
                    const audioUrl = await fetchAndDecodeAudio(`${SYNTETHIZE_ENDPOINT}?conversation_id=${conversationId}&message_id=${messageId}&voice=${voices.selected ?? VOICE}&format=${AUDIO_FORMAT}`);
                    if (audioUrl) await setCompletedStreams(streams => [...streams, audioUrl]);
                } catch (e) {
                    if(retryCount.current !== 0){
                        handleError("ChatGPT seems to be having issues finding the audio, please click the back button on the top-left or close the overlay and try again.");
                        return;
                    }
                    await retry(`${SYNTETHIZE_ENDPOINT}?conversation_id=${conversationId}&message_id=${messageId}&voice=${voices.selected ?? VOICE}&format=${AUDIO_FORMAT}`)
                }
            }
            // setCompletedStreams(streams => [...streams, { messageId, conversationId, createTime, text, chunkNumber }]);
            setCurrentCompletedStream({ messageId, conversationId, createTime, text, chunkNumber })
        }
        setIsLoading(false);
    }, [setIsLoading, token, voices.selected]);

    const handleRateLimitExceeded = useCallback((e: Event) => {
        const { detail } = e as Event & { detail: string };
        toast({ description: detail, style: TOAST_STYLE_CONFIG });
        setIsLoading(false);
    },  [setIsLoading]);

    const reset = () => {
        setCompletedStreams([]);
        setCurrentCompletedStream(null);
    }

    useEffect(() => {
        setError(null);
        window.addEventListener(LISTENERS.END_OF_STREAM, handleConvStream);
        window.addEventListener(LISTENERS.RATE_LIMIT_EXCEEDED, handleRateLimitExceeded);
        return () => {
            window.removeEventListener(LISTENERS.END_OF_STREAM, handleConvStream);
            window.removeEventListener(LISTENERS.RATE_LIMIT_EXCEEDED, handleRateLimitExceeded);
        };
    }, [handleConvStream]);

    return { completedStreams, currentCompletedStream, reset, error, voices, setVoices, isVoiceLoading }

}

export default useStreamListener;