import { LISTENERS, VOICE } from "@/lib/constants";
import { Voice } from "@/pages/content/uploader/voice-selector";
import { useCallback, useEffect, useState } from "react";

const useVoice = () => {
    const [voices, setVoices] = useState<Voice>({ selected: VOICE, voices: [] });
    const [isLoading, setIsLoading] = useState<boolean>(false);

    const handleVoiceReceived = useCallback((event: Event) => {
        const { detail } = event as Event & { detail: Voice };
        setIsLoading(true);
        const storedVoice = window.localStorage.getItem("gptr/voice");
        if (storedVoice) {
            detail.selected = storedVoice;
        }
        setVoices(detail);
        setIsLoading(false);
    }, []);

    const getVoices = useCallback(() => {
        setIsLoading(true);
        const voicesEvent = new CustomEvent(LISTENERS.GET_VOICES)
        window.dispatchEvent(voicesEvent)
    }, []);

    const handleVoiceChange = useCallback((voice: string) => {
        if (window) window.localStorage.setItem("gptr/voice", voice);
        setVoices(p => ({ ...p, selected: voice }));
    }, []);

    useEffect(() => {
        if (voices.voices.length === 0) {
            getVoices();
        }
        window.addEventListener(LISTENERS.VOICES, handleVoiceReceived);
        return () => {
            window.removeEventListener(LISTENERS.VOICES, handleVoiceReceived);
        }
    }, [voices?.voices.length]);

    return { voices, setVoices, getVoices, handleVoiceChange, isLoading };
}

export default useVoice;