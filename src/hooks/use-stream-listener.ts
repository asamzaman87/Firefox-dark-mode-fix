/* eslint-disable @typescript-eslint/no-explicit-any */
import { makeVoicesMock } from "@/lib/utils";
import { useState, useRef, useCallback } from "react";

const useStreamListener = (
  setIsLoading: (state: boolean) => void,
  nextChunkRef: React.MutableRefObject<number>,
  chunkRef: React.MutableRefObject<any[]>,
  injectPrompt: (text: string, id: string, ndx: number) => void,
  isDownload: boolean
) => {
  const [isFetching, setIsFetching] = useState(false);
  const [completedStreams, setCompletedStreams] = useState<string[]>([]);
  const [currentCompletedStream, setCurrentCompletedStream] = useState<{
    messageId: string;
    conversationId: string;
    createTime: number;
    text: string;
    chunkNdx: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [blobs, setBlobs] = useState<{ chunkNumber: number; blob: Blob }[]>([]);
  const promptNdx = useRef<number>(0);
  const isVoiceLoading = false;
  const voices = makeVoicesMock([], "alloy");
    const setVoices = (v: any) => {
    if (Array.isArray(v)) {
        voices.list.splice(0, voices.list.length, ...v);
    } else if (typeof v === "string") {
        voices.selected = v;
    }
    };


  // Dummy callbacks to mimic structure
  const reset = useCallback(() => {
    setIsFetching(false);
    setCompletedStreams([]);
    setCurrentCompletedStream(null);
    setBlobs([]);
    setError(null);
    promptNdx.current = 0;
  }, []);

  // Return same shape as real hook
  return {
    isFetching,
    completedStreams,
    currentCompletedStream,
    reset,
    error,
    voices,
    setVoices,
    isVoiceLoading,
    blobs,
    promptNdx,
  };
};

export default useStreamListener;
