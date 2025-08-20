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
  const [mode, setMode] = useState<SpeechMode>(defaultMode);

  useEffect(() => {
    const saved = localStorage.getItem(MODE_STORAGE_KEY) as SpeechMode | null;
    if (saved) setMode(saved);
  }, []);

  const toggleMode = useCallback(() => {
    setMode((prev) => {
      const newMode =
        prev === "text-to-speech" ? "speech-to-text" : "text-to-speech";
      localStorage.setItem(MODE_STORAGE_KEY, newMode);
      return newMode;
    });
  }, []);

  const value: SpeechModeContextType = {
    mode,
    setMode,
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
