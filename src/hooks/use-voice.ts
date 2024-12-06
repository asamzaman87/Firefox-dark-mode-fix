import { LISTENERS, VOICE } from "@/lib/constants";
import { Voice } from "@/pages/content/uploader/voice-selector";
import { useCallback, useEffect, useState } from "react";

const useVoice = () => {
    const [voices, setVoices] = useState<Voice>({ selected: VOICE, voices: [] });
    const [isLoading, setIsLoading] = useState<boolean>(false);

    const handleVoiceRecevied = useCallback((event: Event) => {
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
        const voicesEvent = new CustomEvent(LISTENERS.GET_VOICES)
        window.dispatchEvent(voicesEvent)
    }, []);

    const handleVoiceChange = useCallback((voice: string) => {
        window && window.localStorage.setItem("gptr/voice", voice);
        setVoices(p => ({ ...p, selected: voice }));
    }, []);

    useEffect(() => {
        //fetches voices 1 sec after the load
        setTimeout(() => {
            if (voices.voices.length === 0) {
                getVoices();
            }
        }, 1000);

        getVoices();
        window.addEventListener(LISTENERS.VOICES, handleVoiceRecevied);
        return () => {
            window.removeEventListener(LISTENERS.VOICES, handleVoiceRecevied);
        }
    }, []);

    return { voices, setVoices, getVoices, handleVoiceChange, isLoading };
}

export default useVoice;