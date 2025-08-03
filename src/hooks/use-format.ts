// src/hooks/use-format.ts
import { useState, useCallback, useEffect } from "react";
import { LISTENERS } from "@/lib/constants";

export type AudioFormat = "MP3" | "OPUS" | "AAC";

export default function useFormat() {
  // — init from localStorage
  const [format, setFormatState] = useState<AudioFormat>(
    () => (localStorage.getItem("audioFormat") as AudioFormat) || "MP3"
  );

  // — answer GET_FORMAT calls
  const handleGet = useCallback(() => {
    window.dispatchEvent(
      new CustomEvent(LISTENERS.FORMAT, { detail: format })
    );
  }, [format]);

  // — listen for requests to ask “what’s the current format?”
  useEffect(() => {
    window.addEventListener(LISTENERS.GET_FORMAT, handleGet);
    return () => {
      window.removeEventListener(LISTENERS.GET_FORMAT, handleGet);
    };
  }, [handleGet]);

  // — listen for any change broadcasts and update our state
  useEffect(() => {
    const onFormatChanged = (e: Event) => {
      const detail = (e as CustomEvent<AudioFormat>).detail;
      setFormatState(detail);
    };
    window.addEventListener(LISTENERS.FORMAT, onFormatChanged as any);
    return () => {
      window.removeEventListener(LISTENERS.FORMAT, onFormatChanged as any);
    };
  }, []);

  // — when *we* change it, persist + broadcast
  const setFormat = useCallback((f: AudioFormat) => {
    localStorage.setItem("audioFormat", f);
    setFormatState(f);
    window.dispatchEvent(new CustomEvent(LISTENERS.FORMAT, { detail: f }));
  }, []);

  return { format, setFormat };
}
