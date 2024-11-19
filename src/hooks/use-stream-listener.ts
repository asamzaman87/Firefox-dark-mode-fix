import { TOAST_STYLE_CONFIG } from "@/lib/constants";
import { extractChunkNumberFromPrompt } from "@/lib/utils";
import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner";

const useStreamListener = (setIsLoading: (state: boolean) => void) => {
    const [completedStreams, setCompletedStreams] = useState<{ messageId: string, conversationId: string, createTime: number, text: string, chunkNumber: string }[]>([]);
    const [currentCompletedStream, setCurrentCompletedStream] = useState<{ messageId: string, conversationId: string, createTime: number, text: string, chunkNumber: string } | null>(null);
    const[ error, setError] = useState<string | null>(null);

    const handleConvStream = useCallback((e: Event) => {
        const { detail: { messageId, conversationId, text, createTime } } = e as Event & { detail: { conversationId: string, messageId: string, createTime: number, text: string } };
        const chunkNumber = extractChunkNumberFromPrompt(text);
        if (chunkNumber) {
            setCompletedStreams(streams => [...streams, { messageId, conversationId, createTime, text, chunkNumber }]);
            setCurrentCompletedStream({ messageId, conversationId, createTime, text, chunkNumber })
        }
        setIsLoading(false);
    }, [setIsLoading]);

    const handleRateLimitExceeded = useCallback((e: Event) => {
        const { detail } = e as Event & { detail: string };
        toast.error(detail, { duration: 10000, position: "top-center", dismissible:true, style: TOAST_STYLE_CONFIG });
        setIsLoading(false);
    },  [setIsLoading]);

    const reset = () =>{
        setCompletedStreams([]);
        setCurrentCompletedStream(null);
    }

    useEffect(() => {
        setError(null);
        window.addEventListener('END_OF_STREAM', handleConvStream);
        window.addEventListener('RATE_LIMIT_EXCEEDED', handleRateLimitExceeded);
        return () => {
            window.removeEventListener('END_OF_STREAM', handleConvStream);
            window.removeEventListener('RATE_LIMIT_EXCEEDED', handleRateLimitExceeded);
        };
    }, [handleConvStream]);

    return { completedStreams, currentCompletedStream, reset, error }

}

export default useStreamListener;