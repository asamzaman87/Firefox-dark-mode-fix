import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import type { ReactNode } from "react";

export type SpeechMode = "text-to-speech" | "speech-to-text";

export interface SpeechModeContextType {
  mode: SpeechMode;
  setMode: (mode: SpeechMode) => void;
  toggleMode: () => void;
  isTextToSpeech: boolean;
}

const SpeechModeContext = createContext<SpeechModeContextType | undefined>(
  undefined
);

interface SpeechModeProviderProps {
  children: ReactNode;
  defaultMode?: SpeechMode; // optional override
}

const MODE_STORAGE_KEY = "gptr/ext-mode";

export const SpeechModeProvider: React.FC<SpeechModeProviderProps> = ({
  children,
  defaultMode = "text-to-speech",
}) => {
  const [mode, _setMode] = useState<SpeechMode>(defaultMode);

  useEffect(() => {
    const saved = localStorage.getItem(MODE_STORAGE_KEY) as SpeechMode | null;
    if (saved) _setMode(saved);
    else localStorage.setItem(MODE_STORAGE_KEY, defaultMode);
    // reflect external writes (other tabs / scripts)
    const onStorage = (e: StorageEvent) => {
      if (e.key === MODE_STORAGE_KEY && e.newValue) {
        _setMode(e.newValue as SpeechMode);
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const setModePersist = useCallback((next: SpeechMode) => {
    _setMode(next);
    localStorage.setItem(MODE_STORAGE_KEY, next);
  }, []);

  const toggleMode = useCallback(() => {
    _setMode((prev) => {
      const newMode =
        prev === "text-to-speech" ? "speech-to-text" : "text-to-speech";
      localStorage.setItem(MODE_STORAGE_KEY, newMode);
      return newMode;
    });
  }, []);

  const value: SpeechModeContextType = {
    mode,
    setMode: setModePersist,
    toggleMode,
    isTextToSpeech: mode === "text-to-speech",
  };

  return (
    <SpeechModeContext.Provider value={value}>
      {children}
    </SpeechModeContext.Provider>
  );
};

export const useSpeechMode = () => {
  const context = useContext(SpeechModeContext);
  if (!context) {
    throw new Error("useSpeechMode must be used within a SpeechModeProvider");
  }
  return context;
};
