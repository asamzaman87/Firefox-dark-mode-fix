import { AUDIO_FORMAT, LISTENERS, SYNTETHIZE_ENDPOINT, TOAST_STYLE_CONFIG, VOICE } from "@/lib/constants";
import { extractChunkNumberFromPrompt } from "@/lib/utils";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import useAuthToken from "./use-auth-token";
import useVoice from "./use-voice";

const useStreamListener = (setIsLoading: (state: boolean) => void) => {
    const [completedStreams, setCompletedStreams] = useState<string[]>([]);
    const [currentCompletedStream, setCurrentCompletedStream] = useState<{ messageId: string, conversationId: string, createTime: number, text: string, chunkNumber: string } | null>(null);
    const [error, setError] = useState<string | null>(null);
    const { token } = useAuthToken();
    const { voices, handleVoiceChange } = useVoice();

    const setVoices = (voice: string) => {
        handleVoiceChange(voice);
    }

    const fetchAndDecodeAudio = useCallback(async (url: string) => {
        const response = await fetch(url, { headers: { "authorization": `Bearer ${token}` } });
        if (response.status !== 200) {
            throw new Error(response.statusText);
        }
        const blob = await response.blob();
        const audioUrl = URL.createObjectURL(blob);
        return audioUrl;
    }, [token])

    const handleConvStream = useCallback(async(e: Event) => {
        const { detail: { messageId, conversationId, text, createTime } } = e as Event & { detail: { conversationId: string, messageId: string, createTime: number, text: string } };
        const chunkNumber = extractChunkNumberFromPrompt(text);
        if (chunkNumber) {
            if(token){
                // prefetching audio
                const audioUrl = await fetchAndDecodeAudio(`${SYNTETHIZE_ENDPOINT}?conversation_id=${conversationId}&message_id=${messageId}&voice=${voices.selected ?? VOICE}&format=${AUDIO_FORMAT}`);
                setCompletedStreams(streams => [...streams, audioUrl]);
            }
            // setCompletedStreams(streams => [...streams, { messageId, conversationId, createTime, text, chunkNumber }]);
            setCurrentCompletedStream({ messageId, conversationId, createTime, text, chunkNumber })
        }
        setIsLoading(false);
    }, [setIsLoading, token, voices.selected]);

    const handleRateLimitExceeded = useCallback((e: Event) => {
        const { detail } = e as Event & { detail: string };
        toast.error(detail, { duration: 1000000, dismissible:true, style: TOAST_STYLE_CONFIG });
        setIsLoading(false);
    },  [setIsLoading]);

    const reset = () =>{
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

    return { completedStreams, currentCompletedStream, reset, error, voices, setVoices }

}

export default useStreamListener;