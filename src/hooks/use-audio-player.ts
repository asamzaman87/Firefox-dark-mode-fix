/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useCallback } from "react";

const useAudioPlayer = (isDownload: boolean) => {
  // Basic mock states
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [playRate, setPlayRate] = useState(1);
  const [volume, setVolume] = useState(0.5);
  const [progress, setProgress] = useState(0);

  // Dummy functions
  const play = useCallback(() => setIsPlaying(true), []);
  const pause = useCallback(() => setIsPaused(true), []);
  const stop = useCallback(() => {
    setIsPlaying(false);
    setIsPaused(false);
    setCurrentIndex(0);
  }, []);
  const replay = useCallback(() => {
    setCurrentIndex(0);
    setIsPlaying(true);
  }, []);
  const reset = useCallback(() => {
    setIsPlaying(false);
    setIsPaused(false);
    setCurrentIndex(0);
    setProgress(0);
  }, []);
  const onForward = useCallback(() => {}, []);
  const onRewind = useCallback(() => {}, []);
  const onScrub = useCallback(() => {}, []);
  const handleVolumeChange = useCallback((vol: number) => setVolume(vol), []);
  const handlePlayRateChange = useCallback((r?: number) => {
    if (r) setPlayRate(r);
  }, []);
  const showInfoToast = useCallback(() => {}, []);

  // Return mocked structure with all expected keys
  return {
    isPlaying,
    isPaused,
    currentIndex,
    playRate,
    volume,
    progress,
    play,
    pause,
    stop,
    replay,
    reset,
    onForward,
    onRewind,
    onScrub,
    handleVolumeChange,
    handlePlayRateChange,
    showInfoToast,
    // Provide placeholders for anything other files might destructure
    chunks: [],
    voices: [],
    text: "",
    isLoading: false,
    isVoiceLoading: false,
    partialChunkCompletedPlaying: false,
    hasCompletePlaying: false,
    isPromptingPaused: false,
    isPresenceModalOpen: false,
    playTimeDuration: 0,
    currentPlayTime: 0,
    extractText: () => {},
    splitAndSendPrompt: () => {},
    reStartChunkProcess: () => {},
    transcribeChunks: () => {},
    cancelTranscription: () => {},
    setText: () => {},
    downloadPreviewText: "",
    downloadPreviewHtml: "",
    setPreviewHtmlSource: () => {},
    downloadCombinedFile: () => {},
    getChunkAtTime: () => 0,
    getChunkStartTime: () => 0,
    getChunkStartOffset: () => 0,
    setProgress,
    setIsPresenceModalOpen: () => {},
    setAudioLoading: () => {},
    setIsPromptingPaused: () => {},
    setIs9thChunk: () => {},
    setVoices: () => {},
    setHasCompletePlaying: () => {},
    setIsBackPressed: () => {},
    isTypeAACSupported: true,
    seekAudio: new Audio(),
    ended: false,
    isAuthenticated: true,
  };
};

export default useAudioPlayer;
