import { LISTENERS } from "@/lib/constants";
import { createHash, UserType } from "@/lib/utils";
import { useCallback, useEffect, useRef, useState } from "react";

const useAuthToken = () => {
    const [token, setToken] = useState<string | null>(null);
    const [userId, setUserId] = useState<string | null>(null);
    const [intervalId, setIntervalId] = useState<NodeJS.Timeout>();
    const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
    const signedOutRef = useRef(false);

    const getTokenEvent = useCallback(() => new CustomEvent(LISTENERS.GET_TOKEN), []);

    function flushSyncStorage() {
      chrome.storage.sync.get(
        ["version", "bannerCount", "countLastViewedOn"],
        (res) => {
          const { version, bannerCount, countLastViewedOn } = res;

          chrome.storage.sync.clear(() => {
            chrome.storage.sync.set({
              version,
              bannerCount,
              countLastViewedOn,
            });
          });
        }
      );
    }

    const updateTheToken = async (token: string, userId: string, userData: UserType) => {
        setToken(token);
        setUserId(userId);
        setIsAuthenticated(!!token);
        localStorage.setItem("gptr/auth", String(!!token));
        const hashToken = await createHash(token);
        if (userData) {
            chrome.storage.sync.get(['email', 'name', 'openaiId', 'picture', 'accessToken', 'hashAccessToken'], async (existingData) => {
                const isUserSwitched = userData.id && existingData.openaiId && existingData.openaiId !== userData.id;

                if (isUserSwitched) {
                  await flushSyncStorage();
                }
                const shouldUpdate = (
                    existingData.email !== userData.email ||
                    existingData.name !== userData.name ||
                    existingData.openaiId !== userData.id ||
                    existingData.picture !== userData.picture ||
                    existingData.accessToken !== token ||
                    existingData.hashAccessToken !== hashToken
                );
                if (shouldUpdate) {
                    chrome.storage.sync.set({
                        email: userData.email,
                        name: userData.name,
                        openaiId: userData.id,
                        picture: userData.picture,
                        accessToken: token,
                        hashAccessToken: hashToken
                    });
                }
            });
        }
    }

    const handleAuthReceived = async (e: Event) => {
        if (signedOutRef.current) return;

        const { detail: { accessToken, userId, userData } } = e as Event & { detail: { accessToken: string, userId: string, userData: UserType } };
        if (accessToken.includes("Bearer")) {
            updateTheToken(accessToken.split(" ")[1], userId, userData);
            return
        }
        updateTheToken(accessToken, userId, userData);
    }

    const handleSignoutReceived = () => {
        signedOutRef.current = true
        setToken(null);
        setUserId(null);
        setIsAuthenticated(false);
        localStorage.removeItem("gptr/auth");

        chrome.runtime.sendMessage({ type: LISTENERS.SIGNOUT_RECEIVED });
    };

    useEffect(() => {
        const id = setInterval(() => {
            if (!signedOutRef.current) {
                window.dispatchEvent(getTokenEvent());
            }
        }, 500);

        setIntervalId(id);
        return () => {
            if (intervalId) clearInterval(intervalId);
        }
    }, []);

    useEffect(() => {
        window.dispatchEvent(getTokenEvent());
        window.addEventListener(LISTENERS.AUTH_RECEIVED, handleAuthReceived);
        window.addEventListener(LISTENERS.SIGNOUT_RECEIVED, handleSignoutReceived);
        return () => {
            window.removeEventListener(LISTENERS.AUTH_RECEIVED, handleAuthReceived);
            window.removeEventListener(LISTENERS.SIGNOUT_RECEIVED, handleSignoutReceived);
        };
    }, [getTokenEvent]);

    return { userId, token, isAuthenticated }

}

export default useAuthToken;