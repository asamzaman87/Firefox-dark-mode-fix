/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useRef, useState } from "react";
import { useToast } from "./use-toast";


const CHUNK_MS = 1200; // how often we "receive" a chunk in the mock

const useWhisperTranscription = () => {
  const [finalText, setFinalText] = useState<string>("");
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const { toast } = useToast();

  // timer that appends mock text while recording
  const chunkTimerRef = useRef<NodeJS.Timeout | null>(null);
  const startedAtRef = useRef<number | null>(null);
  const chunkCountRef = useRef<number>(0);

  // generate a short, varied mock snippet
  const makeChunk = useCallback(() => {
    const i = ++chunkCountRef.current;
    const phrases = [
      "This is a mock transcription chunk.",
      "Speech recognized in the mock.",
      "Continuing simulated transcript…",
      "Mock audio captured successfully.",
      "Appending more mock words.",
    ];
    const body = phrases[i % phrases.length];
    return `${body}`;
  }, []);

  const clearTimer = useCallback(() => {
    if (chunkTimerRef.current) {
      clearInterval(chunkTimerRef.current);
      chunkTimerRef.current = null;
    }
  }, []);

  const start = useCallback(async () => {
    if (isRecording) return;

    setLoading(true);
    // simulate a tiny startup delay
    setTimeout(() => {
      setLoading(false);
      setIsRecording(true);
      startedAtRef.current = Date.now();
      chunkCountRef.current = 0;

      // first immediate chunk so UI sees results quickly
      setFinalText((prev) => (prev ? `${prev} ${makeChunk()}` : makeChunk()));

      // then keep appending every CHUNK_MS
      chunkTimerRef.current = setInterval(() => {
        setFinalText((prev) => (prev ? `${prev} ${makeChunk()}` : makeChunk()));
      }, CHUNK_MS);

      toast({
        id: "recording-toast",
        description:
          "🎙️ (Mock) Live transcription started. Fake chunks will appear every ~1.2s.",
      });
    }, 300);
  }, [isRecording, makeChunk, toast]);

  const stop = useCallback(async () => {
    if (!isRecording) return;

    toast.dismiss("recording-toast");
    clearTimer();

    setIsRecording(false);
    setLoading(false);

    // add a small finishing note to indicate stop
    setFinalText((prev) =>
      prev ? `${prev} [Stopped mock recording]` : "[Stopped mock recording]"
    );
  }, [isRecording, clearTimer, toast]);

  const reset = useCallback(() => {
    toast.dismiss("recording-toast");
    clearTimer();
    setFinalText("");
    setIsRecording(false);
    setLoading(false);
    startedAtRef.current = null;
    chunkCountRef.current = 0;
  }, [clearTimer, toast]);

  return {
    isRecording,
    finalText,
    loading,
    start,
    stop,
    reset,
  };
};

export default useWhisperTranscription;
