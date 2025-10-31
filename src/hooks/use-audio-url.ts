/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useCallback, useRef } from "react";
import { makeVoicesMock } from "@/lib/utils";

const useAudioUrl = (isDownload: boolean) => {
  const [audioUrls, setAudioUrls] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [text, setText] = useState("");
  const [progress, setProgress] = useState(0);
  const [chunks, setChunks] = useState<any[]>([]);
  const voices = makeVoicesMock([], "alloy");
  const setVoices = (v: any) => {
    if (Array.isArray(v)) {
        voices.list.splice(0, voices.list.length, ...v);
    } else if (typeof v === "string") {
        voices.selected = v;
    }
  };
  const [isVoiceLoading, setIsVoiceLoading] = useState(false);
  const [isPromptingPaused, setIsPromptingPaused] = useState(false);
  const [wasPromptStopped, setWasPromptStopped] = useState<"LOADING" | "PAUSED" | "INIT">("INIT");
  const [downloadPreviewText, setDownloadPreviewText] = useState<string>();
  const [downloadPreviewHtml, setDownloadPreviewHtml] = useState<string>("");
  const [is9ThChunk, setIs9thChunk] = useState(false);

  const reStartChunkProcess = useCallback(() => {}, []);
  const extractText = useCallback(async (_file: File) => "", []);
  const splitAndSendPrompt = useCallback(async (_text: string) => {}, []);
  const transcribeChunks = useCallback(async (_file: File) => {}, []);
  const cancelTranscription = useCallback(() => {}, []);
  const reset = useCallback(() => {
    setAudioUrls([]);
    setText("");
    setProgress(0);
    setChunks([]);
    setVoices([]);
    setIsLoading(false);
    setIsPromptingPaused(false);
  }, []);
  const setPreviewHtmlSource = useCallback((_html?: string | null) => {}, []);
  const downloadCombinedFile = useCallback(async (_fileName: string) => {}, []);

  const blobs = useRef<any[]>([]).current;
  const isFetching = false;
  const ended = false;

  return {
    downloadPreviewText,
    downloadPreviewHtml,
    setPreviewHtmlSource,
    downloadCombinedFile,
    progress,
    setProgress,
    blobs,
    isFetching,
    wasPromptStopped,
    setWasPromptStopped,
    chunks,
    voices,
    setVoices,
    isVoiceLoading,
    text,
    audioUrls,
    setAudioUrls,
    extractText,
    splitAndSendPrompt,
    ended,
    isLoading,
    setIsLoading,
    reset,
    is9ThChunk,
    reStartChunkProcess,
    setIs9thChunk,
    isPromptingPaused,
    setIsPromptingPaused,
    transcribeChunks,
    cancelTranscription,
    setText,
  };
};

export default useAudioUrl;
