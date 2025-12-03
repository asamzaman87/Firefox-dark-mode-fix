import { LISTENERS, MALE_VOICES, VOICE } from "@/lib/constants";
import { Voice } from "@/pages/content/uploader/voice-selector";
import { waitForAuthToken } from "@/lib/utils";
import { useCallback, useEffect, useRef, useState } from "react";

const useVoice = () => {
    const [voices, setVoices] = useState<Voice>({ selected: VOICE, voices: [] });
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const loadingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const addGenderToVoice = (detail: Voice) => {
        const voices = detail.voices.map((voice) => {
                return { ...voice, gender: MALE_VOICES.includes(voice.voice) ? chrome.i18n.getMessage("male") : chrome.i18n.getMessage("female") };
        });
        return { selected: detail.selected, voices };
    }

    const handleVoiceReceived = useCallback((event: Event) => {
        const { detail } = event as Event & { detail: Voice };
        // Clear any pending timeout since we received voices
        if (loadingTimeoutRef.current) {
            clearTimeout(loadingTimeoutRef.current);
            loadingTimeoutRef.current = null;
        }
        // Don't set loading to true here - it's already set in getVoices()
        // Just process the received voices
        const storedVoice = window.localStorage.getItem("gptr/voice");
        if (storedVoice) {
            detail.selected = storedVoice;
        }
        setVoices(addGenderToVoice(detail));
        setIsLoading(false); // Always clear loading when voices are received
    }, []);

    const getVoices = useCallback(async () => {
        // Clear any existing timeout
        if (loadingTimeoutRef.current) {
            clearTimeout(loadingTimeoutRef.current);
            loadingTimeoutRef.current = null;
        }
        
        setIsLoading(true);
        
        // Check cache FIRST - no need to wait for injected.js or auth token if we have cached data
        const CACHE_KEY = "gptr/cachedVoices";
        const CACHE_EXPIRY_KEY = "gptr/cachedVoicesExpiry";
        try {
            const cachedData = localStorage.getItem(CACHE_KEY);
            const cachedExpiry = localStorage.getItem(CACHE_EXPIRY_KEY);
            if (cachedData && cachedExpiry && Date.now() < Number(cachedExpiry)) {
                const data = JSON.parse(cachedData);
                // Dispatch immediately - listener is already registered
                window.dispatchEvent(new CustomEvent(LISTENERS.VOICES, { detail: data }));
                setIsLoading(false);
                return;
            }
        } catch (e) {
            // ignore cache read errors
        }
        
        // Cache miss or expired - need to fetch from API
        try {
            // Wait for auth token before dispatching GET_VOICES
            const authToken = await waitForAuthToken(10000); // 10 second timeout
            if (!authToken) {
                window.dispatchEvent(new CustomEvent(LISTENERS.VOICES, { 
                    detail: { voices: [], selected: null } 
                }));
                setIsLoading(false);
                return;
            }
            // Token is available, dispatch GET_VOICES event
            const voicesEvent = new CustomEvent(LISTENERS.GET_VOICES);
            window.dispatchEvent(voicesEvent);
            
            // Set a timeout to clear loading state if VOICES event never arrives
            // This is a safety net in case the event handler fails silently
            loadingTimeoutRef.current = setTimeout(() => {
                setIsLoading(false);
                loadingTimeoutRef.current = null;
            }, 15000); // 15 seconds total (10s for token + 5s buffer for API call)
        } catch {
            // Dispatch empty voices to prevent indefinite waiting
            window.dispatchEvent(new CustomEvent(LISTENERS.VOICES, { 
                detail: { voices: [], selected: null } 
            }));
            setIsLoading(false);
        }
    }, []);

    const handleVoiceChange = useCallback((voice: string) => {
        if (window) window.localStorage.setItem("gptr/voice", voice);
        setVoices(p => ({ ...p, selected: voice }));
    }, []);

    useEffect(() => {
        // Always register the listener first to ensure it's ready before any events are dispatched
        window.addEventListener(LISTENERS.VOICES, handleVoiceReceived);
        return () => {
            window.removeEventListener(LISTENERS.VOICES, handleVoiceReceived);
        }
    }, [handleVoiceReceived]);

    useEffect(() => {
        if (voices.voices.length === 0) {
            getVoices();
        }
    }, [voices?.voices.length, getVoices]);

    return { voices, setVoices, getVoices, handleVoiceChange, isLoading };
}

export default useVoice;