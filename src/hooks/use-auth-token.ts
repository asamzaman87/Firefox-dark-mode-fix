import { LISTENERS } from "@/lib/constants";
import { useCallback, useEffect, useState } from "react";

const useAuthToken = () => {
    const [token, setToken] = useState<string | null>(null);
    const [intervalId, setIntervalId] = useState<NodeJS.Timeout>();
    const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
    
    const getTokenEvent = useCallback(() => new CustomEvent(LISTENERS.GET_TOKEN), []);

    const updateTheToken = (token: string) => {
        setToken(token);
        setIsAuthenticated(!!token);
    }

    const handleAuthReceived = (e: Event) => {
        const { detail: { accessToken } } = e as Event & { detail: { accessToken: string } };
        if (accessToken.includes("Bearer")) {
            updateTheToken(accessToken.split(" ")[1])
            return
        }
        updateTheToken(accessToken);
    }

    useEffect(() => {
        const id = setInterval(() => {
            window.dispatchEvent(getTokenEvent());
        }, 1000);

        setIntervalId(id);
        return () => {
            if (intervalId) clearInterval(intervalId);
        }
    }, []);

    useEffect(() => {
        window.dispatchEvent(getTokenEvent());
        window.addEventListener(LISTENERS.AUTH_RECEIVED, handleAuthReceived);
        return () => {
            window.removeEventListener(LISTENERS.AUTH_RECEIVED, handleAuthReceived);
        };
    }, [getTokenEvent]);

    return { token, isAuthenticated }

}

export default useAuthToken;