import { VOICE } from "@/lib/constants";
import { Voice } from "@/pages/content/uploader/voice-selector";
import { useCallback, useEffect, useState } from "react";

const useVoice = () => {
    const [voices, setVoices] = useState<Voice>({ selected: VOICE, voices: [] });

    const handleVoiceRecevied = useCallback((event: Event) => {
        const { detail } = event as Event & { detail: Voice };
        setVoices(detail);
    }, []);

    const getVoices = useCallback(() => {
        const voicesEvent = new CustomEvent("GET_VOICES")
        window.dispatchEvent(voicesEvent)
    }, []);

    const handleVoiceChange = useCallback((voice: string) => {
        setVoices(p => ({ ...p, selected: voice }));
    }, []);

    useEffect(() => {
        getVoices();
        window.addEventListener('VOICES', handleVoiceRecevied);
        return () => {
            window.removeEventListener('VOICES', handleVoiceRecevied);
        }
    }, []);

    return { voices, setVoices, getVoices, handleVoiceChange };
}

export default useVoice;