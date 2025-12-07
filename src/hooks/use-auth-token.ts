import { LISTENERS } from "@/lib/constants";
import { createHash, UserType } from "@/lib/utils";
import { useCallback, useEffect, useRef, useState } from "react";

const useAuthToken = () => {
    const [token, setToken] = useState<string | null>(null);
    const [userId, setUserId] = useState<string | null>(null);
    const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
    const signedOutRef = useRef(false);
    const hasClearedForCurrentLoginStateRef = useRef(false);

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
        localStorage.removeItem("gptr/cachedSessionToken");
        localStorage.removeItem("gptr/cachedSessionExpiry");

        chrome.runtime.sendMessage({ type: LISTENERS.SIGNOUT_RECEIVED });
    };

    useEffect(() => {
        const id = setInterval(() => {
            if (!document.querySelector("[data-testid='login-button']")) {
                if (!token) setToken('test');
                if (!isAuthenticated) setIsAuthenticated(true);
                if (!userId) setUserId('test');
            }
            window.dispatchEvent(getTokenEvent());
        }, 2500);

        return () => clearInterval(id);
    }, [token, getTokenEvent]);

    useEffect(() => {
        // Check storage first before dispatching GET_TOKEN
        (async () => {
            try {
                const stored = await chrome.storage.local.get(["gptr/cachedSessionToken", "gptr/cachedSessionExpiry"]);
                if (stored["gptr/cachedSessionToken"]?.accessToken && 
                    stored["gptr/cachedSessionExpiry"] && 
                    Date.now() < stored["gptr/cachedSessionExpiry"]) {
                    const tokenData = stored["gptr/cachedSessionToken"];
                    // Dispatch AUTH_RECEIVED with cached token
                    window.dispatchEvent(new CustomEvent(LISTENERS.AUTH_RECEIVED, {
                        detail: {
                            accessToken: tokenData.accessToken,
                            userId: tokenData.userId,
                            userData: tokenData.userData,
                        }
                    }));
                    return; // Don't dispatch GET_TOKEN if we have valid cached token
                }
            } catch (e) {
                console.warn("Failed to check storage for cached token:", e);
            }
            // If no valid cached token, dispatch GET_TOKEN
            window.dispatchEvent(getTokenEvent());
        })();
        
        window.addEventListener(LISTENERS.AUTH_RECEIVED, handleAuthReceived);
        window.addEventListener(LISTENERS.SIGNOUT_RECEIVED, handleSignoutReceived);
        return () => {
            window.removeEventListener(LISTENERS.AUTH_RECEIVED, handleAuthReceived);
            window.removeEventListener(LISTENERS.SIGNOUT_RECEIVED, handleSignoutReceived);
        };
    }, [getTokenEvent]);

    // Constantly monitor for login button appearance and clear chrome storage if it appears
    useEffect(() => {
        const checkLoginButton = async () => {
            const isLoggedOut = !!document.querySelector("[data-testid='login-button']");

            // If login button disappeared (user logged in), reset the flag
            if (!isLoggedOut && hasClearedForCurrentLoginStateRef.current) {
                hasClearedForCurrentLoginStateRef.current = false;
                return;
            }

            // Only clear once per logout detection
            if (!isLoggedOut || hasClearedForCurrentLoginStateRef.current) {
                return;
            }

            try {
                // Only fetch the keys we actually care about
                const syncKeysToPreserve = ["version", "bannerCount", "countLastViewedOn"];
                const localKeysToPreserve = ["origin"];

                const syncData = await chrome.storage.sync.get(syncKeysToPreserve);
                const localData = await chrome.storage.local.get(localKeysToPreserve);

                // Clear sync storage, then restore preserved keys
                await new Promise<void>((resolve) => {
                    chrome.storage.sync.clear(() => {
                        chrome.storage.sync.set(syncData, resolve);
                    });
                });

                // Clear local storage, then restore preserved keys
                await new Promise<void>((resolve) => {
                    chrome.storage.local.clear(() => {
                        chrome.storage.local.set(localData, resolve);
                    });
                });

                // Also clear localStorage caches
                localStorage.removeItem("gptr/cachedSessionToken");
                localStorage.removeItem("gptr/cachedSessionExpiry");
                localStorage.removeItem("gptr/auth");

                if (window.__gptReaderCachedToken) {
                    window.__gptReaderCachedToken = undefined;
                }

                // Mark cleanup done for this logout detection
                hasClearedForCurrentLoginStateRef.current = true;

            } catch (err) {
                // Silently ignore errors
            }
        };

        const intervalId = setInterval(checkLoginButton, 2000);
        return () => clearInterval(intervalId);
    }, []);

    return { userId, token, isAuthenticated }

}

export default useAuthToken;