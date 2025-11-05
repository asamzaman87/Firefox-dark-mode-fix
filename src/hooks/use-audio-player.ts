/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useMemo, useState } from "react";

// Minimal Voice type to match VoiceSelector expectations
type VoiceItem = {
  bloop_color: string;
  description: string;
  name: string;
  preview_url: string;
  voice: string;
  gender?: string;
  premium?: boolean;
};

type VoicesShape = {
  selected: string;
  voices: VoiceItem[];
};

const DEFAULT_VOICES: VoiceItem[] = [
  {
    bloop_color: "#4f46e5",
    description: "Clear, balanced voice for general listening.",
    name: "Alloy",
    preview_url: "about:blank",
    voice: "alloy",
    gender: "Male",
    premium: false,
  },
  {
    bloop_color: "#16a34a",
    description: "Warm, friendly voice.",
    name: "Nova",
    preview_url: "about:blank",
    voice: "nova",
    gender: "Female",
    premium: false,
  },
];

const useAudioPlayer = (_isDownload: boolean) => {
  // ---------- Core playback & UI state ----------
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [playRate, setPlayRate] = useState(1);
  const [volume, setVolume] = useState(0.8);
  const [progress, setProgress] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(false); // used by Content
  const [isBackPressed, setIsBackPressed] = useState(false); // used by Content

  // Presence modal
  const [isPresenceModalOpen, setIsPresenceModalOpen] = useState(false);

  // ---------- Text / chunks / blobs ----------
  const [text, _setText] = useState<string>("");
  const [chunks, setChunks] = useState<Array<{ text: string }>>([]);
  const [blobs, setBlobs] = useState<Array<{ type?: string; size?: number }>>([]);

  // ---------- Player timing ----------
  const [playTimeDuration, setPlayTimeDuration] = useState<number>(60);
  const [currentPlayTime, setCurrentPlayTime] = useState<number>(0);

  // ---------- Voices (shape expected by VoiceSelector) ----------
  const [voicesState, setVoicesState] = useState<VoicesShape>({
    selected: "alloy",
    voices: DEFAULT_VOICES,
  });

  // Voice loading flags
  const [isVoiceLoading] = useState<boolean>(false);

  // Playback lifecycle helpers
  const partialChunkCompletedPlaying = false;
  const [hasCompletePlaying, setHasCompletePlaying] = useState(false);

  // Download preview fields
  const downloadPreviewText = useMemo(() => text, [text]);
  const [downloadPreviewHtml, setDownloadPreviewHtml] = useState<string>("");

  // Seekable audio (UI expects an Audio object)
  const seekAudio = useMemo(() => new Audio(), []);
  const ended = false;

  // ---------- Controls ----------
  const play = useCallback(() => {
    setIsPlaying(true);
    setIsPaused(false);
  }, []);

  const pause = useCallback(() => {
    setIsPaused(true);
    setIsPlaying(false);
  }, []);

  const togglePlay = useCallback(() => {
    setIsPlaying((p) => {
      const next = !p;
      setIsPaused(!next);
      return next;
    });
  }, []);

  const stop = useCallback(() => {
    setIsPlaying(false);
    setIsPaused(false);
    setCurrentIndex(0);
    setCurrentPlayTime(0);
    setProgress(0);
  }, []);

  const replay = useCallback(() => {
    setCurrentIndex(0);
    setCurrentPlayTime(0);
    setIsPlaying(true);
    setIsPaused(false);
  }, []);

  const reset = useCallback(
    (_hard?: boolean, _opts?: unknown, backPressed?: boolean) => {
      stop();
      setChunks([]);
      setBlobs([]);
      setHasCompletePlaying(false);
      if (backPressed) setIsBackPressed(true);
    },
    [stop]
  );

  const onForward = useCallback(() => {
    setCurrentPlayTime((t) => Math.min(playTimeDuration, t + 10));
  }, [playTimeDuration]);

  const onRewind = useCallback(() => {
    setCurrentPlayTime((t) => Math.max(0, t - 10));
  }, []);

  const onScrub = useCallback(
    (t: number) => {
      const clamped = Math.max(0, Math.min(playTimeDuration, t || 0));
      setCurrentPlayTime(clamped);
      // set a simple visual progress mapping (0-100)
      const pct = playTimeDuration > 0 ? 100 - Math.round((clamped / playTimeDuration) * 100) : 100;
      setProgress(pct);
    },
    [playTimeDuration]
  );

  const handleVolumeChange = useCallback((vol: number) => {
    setVolume(Math.max(0, Math.min(1, vol)));
  }, []);

  const handlePlayRateChange = useCallback((r?: number) => {
    if (r && Number.isFinite(r)) setPlayRate(r);
  }, []);

  const showInfoToast = useCallback((_ms?: number) => {
    /* noop in mock */
  }, []);

  // ---------- Voice helpers expected by UI ----------
  const voices = voicesState; // alias to match Content’s name
  const setVoices = (v: any) => {
    // Supports setVoices("alloy") or setVoices([...]) or full object
    if (typeof v === "string") {
      setVoicesState((prev) => ({ ...prev, selected: v }));
    } else if (Array.isArray(v)) {
      setVoicesState((prev) => ({ ...prev, voices: v }));
    } else if (v && typeof v === "object" && Array.isArray(v.voices)) {
      setVoicesState({
        selected: v.selected || voicesState.selected,
        voices: v.voices,
      });
    }
  };

  // ---------- TTS/STT hooks the UI calls ----------
  const setText = (t: string) => {
    _setText(t ?? "");
  };

  const setPreviewHtmlSource = (html?: string) => {
    setDownloadPreviewHtml(html ?? "");
  };

  const extractText = useCallback(async (file: File) => {
    try {
      const content = await file.text();
      return content || "";
    } catch {
      return "";
    }
  }, []);

  /**
   * Advances the flow to the player page and ensures play/pause buttons
   * are visible by starting in the "playing" state.
   */
  const splitAndSendPrompt = useCallback(
    async (t: string) => {
      setIsFetching(true);
      const finalText = (t && t.trim().length ? t : text) || "this is a test";
      _setText(finalText);

      // Minimal “one chunk” so getChunk* helpers work
      setChunks([{ text: finalText }]);

      // Provide at least one blob so progress/delay math in Content won’t break
      setBlobs([{ type: "audio/aac", size: Math.max(1, finalText.length) }]);

      // Fake duration as 1 min min, or text length scaled
      const dur = Math.max(60, Math.ceil(finalText.length / 10));
      setPlayTimeDuration(dur);

      // Make the player show Pause immediately (so controls are obvious)
      setIsPlaying(true);
      setIsPaused(false);

      setIsFetching(false);
      return true;
    },
    [text]
  );

  const reStartChunkProcess = useCallback((_fromPresence?: boolean) => {
    setIsPlaying(true);
    setIsPaused(false);
  }, []);

  const transcribeChunks = useCallback(async (_file: File) => {
    // STT path mock: pretend we “transcribed”
    setIsFetching(true);
    const fake = "Transcribed text (mock)";
    _setText(fake);
    setChunks([{ text: fake }]);
    setBlobs([{ type: "audio/aac", size: fake.length }]);
    setPlayTimeDuration(45);
    setIsPlaying(true);
    setIsPaused(false);
    setIsFetching(false);
  }, []);

  const cancelTranscription = useCallback(() => {
    setIsFetching(false);
  }, []);

  const downloadCombinedFile = useCallback((_fileName?: string) => {
    // no-op in mock
  }, []);

  // ---------- Chunk helpers expected by “Locate Audio” ----------
  const getChunkAtTime = useCallback(
    (_seconds: number) => {
      // We only expose 1 chunk; return 1 if we have anything
      return chunks.length ? 1 : 0;
    },
    [chunks.length]
  );

  const getChunkStartTime = useCallback((_n: number) => 0, []);
  const getChunkStartOffset = useCallback((_n: number) => 0, []);

  // ---------- Flags ----------
  const isTypeAACSupported = true;
  const isAuthenticated = true;

  return {
    // playback & timing
    isPlaying,
    isPaused,
    currentIndex,
    playRate,
    volume,
    progress,
    playTimeDuration,
    currentPlayTime,

    // controls
    play,
    pause,
    togglePlay, // <— added for components that prefer a single toggler
    stop,
    replay,
    reset,
    onForward,
    onRewind,
    onScrub,
    handleVolumeChange,
    handlePlayRateChange,
    showInfoToast,

    // data + flow
    text,
    setText,
    chunks,
    blobs,
    splitAndSendPrompt,
    extractText,
    reStartChunkProcess,
    transcribeChunks,
    cancelTranscription,

    // UI flags
    isLoading,
    isFetching,
    isTypeAACSupported,
    isVoiceLoading,
    partialChunkCompletedPlaying,
    hasCompletePlaying,
    setHasCompletePlaying,
    isPresenceModalOpen,
    setIsPresenceModalOpen,
    isBackPressed,
    setIsBackPressed,

    // voices
    voices,
    setVoices,

    // download preview
    downloadPreviewText,
    downloadPreviewHtml,
    setPreviewHtmlSource,
    downloadCombinedFile,

    // locate helpers
    getChunkAtTime,
    getChunkStartTime,
    getChunkStartOffset,

    // misc expected by UI
    seekAudio,
    ended,
    isAuthenticated,
  };
};

export default useAudioPlayer;
