import { useCallback, useEffect, useState } from "react";

const useAuthToken = () => {
    const [token, setToken] = useState<string | null>(null);
    const [intervalId, setIntervalId] = useState<NodeJS.Timeout>();
    const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);

    const isSendButtonPresentOnDom = useCallback(() => {
        const sendButton: HTMLButtonElement | null = document.querySelector("[data-testid='send-button']");
        return sendButton !== null;
    }, []);

    const getTokenEvent = useCallback(() => new CustomEvent("GET_TOKEN"), []);

    const handleAuthReceived = (e: Event) => {
        const { detail: { accessToken } } = e as Event & { detail: { accessToken: string } };
        if (accessToken.includes("Bearer")) {
            setToken(accessToken.split(" ")[1]);
            setIsAuthenticated(isSendButtonPresentOnDom() && !!accessToken);
            return
        }
        setToken(accessToken);
        setIsAuthenticated(isSendButtonPresentOnDom() && !!accessToken);
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
        window.addEventListener('AUTH_RECEIVED', handleAuthReceived);
        return () => {
            window.removeEventListener('AUTH_RECEIVED', handleAuthReceived);
        };
    }, [getTokenEvent]);

    return { token, isAuthenticated }

}

export default useAuthToken;