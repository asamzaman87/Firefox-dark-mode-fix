import { LISTENERS, VOICE } from "@/lib/constants";
import { Voice } from "@/pages/content/uploader/voice-selector";
import { useCallback, useEffect, useState } from "react";

const useVoice = () => {
    const [voices, setVoices] = useState<Voice>({ selected: VOICE, voices: [] });

    const handleVoiceRecevied = useCallback((event: Event) => {
        const { detail } = event as Event & { detail: Voice };
        const storedVoice = window.localStorage.getItem("gptr/voice");
        if (storedVoice) {
            detail.selected = storedVoice;
        }
        setVoices(detail);
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
        setTimeout(()=>{
            if(voices.voices.length===0){
                getVoices();
            }
        }, 1000);

        getVoices();
        window.addEventListener(LISTENERS.VOICES, handleVoiceRecevied);
        return () => {
            window.removeEventListener(LISTENERS.VOICES, handleVoiceRecevied);
        }
    }, []);

    return { voices, setVoices, getVoices, handleVoiceChange };
}

export default useVoice;