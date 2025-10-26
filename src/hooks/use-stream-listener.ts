import { FREE_DOWNLOAD_CHUNKS, LISTENERS, LOCAL_LOGS, SYNTHESIZE_ENDPOINT, TOAST_STYLE_CONFIG, TOAST_STYLE_CONFIG_INFO, VOICE } from "@/lib/constants";
import { useCallback, useEffect, useRef, useState } from "react";
import useAuthToken from "./use-auth-token";
import { useToast } from "./use-toast";
import useVoice from "./use-voice";
import { addChatToDeleteLS, Chunk, collectChatsAboveTopChat, deleteChatAndCreateNew, handleError, maybeDeleteChat, normalizeAlphaNumeric, removeChatFromDeleteLS, waitForElement } from "@/lib/utils";
import useFormat from "./use-format";
import { usePremiumModal } from "@/context/premium-modal";
const MAX_RETRIES = 4; 
const useStreamListener = (
    setIsLoading: (state: boolean) => void,
    nextChunkRef: React.MutableRefObject<number>,                      
    chunkRef: React.MutableRefObject<Chunk[]>,                            
    injectPrompt: (text: string, id: string, ndx: number) => void, 
    isDownload: boolean,           
  ) => {
    const { format } = useFormat();
    const { toast } = useToast();
    const [completedStreams, setCompletedStreams] = useState<string[]>([]);
    const [currentCompletedStream, setCurrentCompletedStream] = useState<{ messageId: string, conversationId: string, createTime: number, text: string, chunkNdx: number } | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isFetching, setIsFetching] = useState<boolean>(false);
    const { token } = useAuthToken();
    const { voices, handleVoiceChange, isLoading: isVoiceLoading } = useVoice();
    const [blobs, setBlobs] = useState<{ chunkNumber: number; blob: Blob }[]>([]);
    const didIt = useRef<Set<number>>(new Set());
    const audioIssueStop = useRef<boolean>(false);
    const stopFlow = useRef<boolean>(false);
    const audioIssueInjections = useRef<Set<number>>(new Set());

    const retryCounts = useRef<Record<number, number>>({});
    const lastRegularRetryChunk = useRef<Set<number>>(new Set());
    const promptNdx = useRef<number>(0);
    const { isSubscribed } = usePremiumModal();

    // —— CHAT / FETCH TRACKING & LS BRIDGE ——
    // Current chat (never delete it here; the Uploader owns current chat deletion on unload/load)
    const currentChatIdRef = useRef<string | null>(null);

    // Map: chatId -> Set of convKeys `${conversationId}:${messageId}` (one per synth fetch)
    const chatToPendingRef = useRef<Map<string, Set<string>>>(new Map());

    const registerPending = (chatId: string, convKey: string) => {
        let set = chatToPendingRef.current.get(chatId);
        if (!set) {
            set = new Set<string>();
            chatToPendingRef.current.set(chatId, set);
        }
        set.add(convKey);
    };

    const completePending = async (chatId: string, convKey: string) => {
        const set = chatToPendingRef.current.get(chatId);
        if (set) {
            set.delete(convKey);
            if (set.size === 0) {
                chatToPendingRef.current.delete(chatId);
                // not the current chat? try to delete now (fallback to LS)
                if (chatId !== currentChatIdRef.current) {
                    await maybeDeleteChat(chatId);
                }
            }
        }
    };
    
    const setVoices = (voice: string) => {
        handleVoiceChange(voice);
    }

    const handleErrorWithNoFetch = (msg: string) => {
        handleError(msg);
        setIsFetching(false);
        return
    }

    const retryFlow = useCallback(
        async (failedChunkNdx: number) => {
            if (failedChunkNdx < 0 || failedChunkNdx >= chunkRef.current.length) {
                if (LOCAL_LOGS) console.log("[retryFlow] invalid chunk index", failedChunkNdx);
                return;
            }

            const stopButton: HTMLButtonElement | null = document.querySelector("[data-testid='stop-button']");
            if (stopButton) {
                stopButton.click();
            }

            // bump counter (kept for telemetry/visibility even though we don't cap in fetch path)
            retryCounts.current[failedChunkNdx] = (retryCounts.current[failedChunkNdx] ?? 0) + 1;

            if (retryCounts.current[failedChunkNdx] > MAX_RETRIES) {
                handleErrorWithNoFetch('GPT Reader seems to be having issues. Please contact me at democraticdeveloper@gmail.com if you continue to see this error.');
                return;
            }

            // open a new chat (do not delete old one here)
            await new Promise<void>(async (resolve) => {
                const newChatBtn = document.querySelector<HTMLButtonElement>(
                    "[data-testid='create-new-chat-button'], [aria-label='New chat']"
                );
                if (newChatBtn) {
                    await collectChatsAboveTopChat(false);
                    newChatBtn.click();
                    // wait briefly for the new chat URL
                    for (let i = 0; i < 10; i++) {
                        await new Promise((r) => setTimeout(r, 200));
                        const urlChat = window.location.href;
                        if (urlChat === "https://chatgpt.com/") break;
                    }
                }
                resolve();
            });

            // re-inject SAME chunk text in the new chat
            const { text, id } = chunkRef.current[failedChunkNdx];
            promptNdx.current += 1;
            toast({
                description: `GPT Reader is configuring ChatGPT, please wait a few seconds for the next audio chunk...`,
                style: TOAST_STYLE_CONFIG_INFO,
                duration: 10000
            });
            injectPrompt(text, id, promptNdx.current);
        },
        [chunkRef, injectPrompt, toast]
    );

    const fetchAndDecodeAudio = useCallback(async (url: string, chunkNumber: number, conversationId: string, messageId: string) => {
        setIsFetching(true);
        const convKey = `${conversationId}:${messageId}`;
        try {
            // if (chunkNumber % 3 === 0 && !didIt.current.has(chunkNumber)) {
            //     didIt.current.add(chunkNumber);
            //     throw new Error("Cannot fetch audio");
            // }
            // ——— ensure we have a valid token ———
            let authToken = token;
            if (!authToken) {
                window.dispatchEvent(new Event("GET_TOKEN"));
                authToken = await Promise.race<string | null>([
                    new Promise((resolve) => {
                        const handler = (e: Event) => {
                            const ce = e as CustomEvent<{ accessToken: string }>;
                            window.removeEventListener("AUTH_RECEIVED", handler);
                            resolve(ce.detail.accessToken);
                        };
                        window.addEventListener("AUTH_RECEIVED", handler, { once: true });
                    }),
                    new Promise<null>((_, reject) =>
                        setTimeout(() => reject(new Error("Token request timed out")), 15000)
                    ),
                ]).catch(() => {
                    handleErrorWithNoFetch("GPT Reader is having issues finding the audio. Please refresh the page and try again.");
                    return null;
                });
                if (!authToken) {
                    console.error("[fetchAndDecodeAudio] cannot fetch token");
                    return;
                }
            }

            let response: Response | undefined;
            try {
                response = await fetch(url, { headers: { "authorization": `Bearer ${authToken}` } });
            } catch {
                const start = Date.now();
                while (Date.now() - start < 1500) {
                    await new Promise((r) => setTimeout(r, 300));
                    response = await fetch(url, { headers: { "authorization": `Bearer ${authToken}` } });
                    if (response.status === 200) break;
                }
                if (!response) {
                    throw new Error("Cannot fetch audio");
                }
            }

            if (response.status === 404) {
                const start = Date.now();
                while (Date.now() - start < 5000) {
                    await new Promise((r) => setTimeout(r, 500));
                    response = await fetch(url, { headers: { "authorization": `Bearer ${authToken}` } });
                    if (response.status === 200) break;
                }
            }

            // —— regular retry first time ——
            if (response.status !== 200) {
                if (!lastRegularRetryChunk.current.has(chunkNumber) && response.status !== 404) {
                    lastRegularRetryChunk.current.add(chunkNumber);
                    return await retry(url, chunkNumber, conversationId, messageId);
                }
            }

            if (response.status !== 200) {
                if (response.status === 429) {
                    handleErrorWithNoFetch("You have exceeded the hourly limit for your current ChatGPT model. Please switch to another model to continue using GPT Reader or wait a few minutes.");
                    return;
                }
                throw new Error("Cannot fetch audio");
            }

            let blob: Blob;
            try {
                blob = await response.blob();
            } catch (err) {
                console.warn(`Audio blob read failed for chunk ${chunkNumber}, retrying…`, err);
                if (!lastRegularRetryChunk.current.has(chunkNumber)) {
                    lastRegularRetryChunk.current.add(chunkNumber);
                    return await retry(url, chunkNumber, conversationId, messageId);
                } else {
                    throw new Error("Cannot fetch audio");
                }
            }

            setBlobs(prev => {
                const next = prev.filter(e => e.chunkNumber !== chunkNumber);
                if (!isSubscribed && isDownload && chunkNumber > FREE_DOWNLOAD_CHUNKS) {
                    return next;
                }
                next.push({ chunkNumber, blob });
                next.sort((a, b) => a.chunkNumber - b.chunkNumber);
                return next;
            });

            setIsFetching(false);

            try {
                const audioUrl = URL.createObjectURL(blob);
                return audioUrl;
            } catch (err) {
                console.warn(`Audio URL creation failed for chunk ${chunkNumber}`, err);
                return;
            }
        } catch (err) {
            if (LOCAL_LOGS) console.warn("[fetchAndDecodeAudio] top-level error:", err);
            audioIssueInjections.current.add(chunkNumber);
            const stopButton = document.querySelector<HTMLButtonElement>("[data-testid='stop-button']");
            if (nextChunkRef.current === chunkRef.current.length && !stopButton) {
                // Convert to array and sort ascending
                const sorted = Array.from(audioIssueInjections.current).sort((a, b) => a - b);

                // Take the first (lowest) element
                const first = sorted[0];

                console.warn(`[audioIssueInjections] Injecting audio for chunk ${first}`);

                // Inject using the first element
                injectPrompt(
                    chunkRef.current[first].text,
                    chunkRef.current[first].id,
                    promptNdx.current
                );

                audioIssueInjections.current.delete(first);
                stopFlow.current = true;
            } else if (!stopFlow.current) {
                localStorage.setItem('gptr/abort', 'true');
                audioIssueStop.current = true;
                console.log('gptr/abort SET FOR CHUNK NUMBER:', chunkNumber);
            }
            return;
        } finally {
            await completePending(conversationId, convKey);
        }
    }, [token, retryFlow, isDownload, isSubscribed]);


    //retry fetching audio
    const retry = useCallback(async (url: string, chunkNumber: number, conversationId: string, messageId: string): Promise<string | undefined> => {
        await new Promise((res) => setTimeout(res, 500));
        return await fetchAndDecodeAudio(url, chunkNumber, conversationId, messageId);
    }, [fetchAndDecodeAudio]);


    const handleConvStream = useCallback(async (e: Event) => {
        let { detail: { messageId, conversationId, text, createTime, chunkNdx, assistant, stopConvo, target } } = e as Event & { detail: { conversationId: string, messageId: string, createTime: number, text: string, chunkNdx: number, assistant: string, stopConvo: boolean, target: string } };
        if (LOCAL_LOGS) console.log("[handleConvStream] Use stream listener got event for chunk number:", chunkNdx);
        if (LOCAL_LOGS) {
            if (document.querySelector<HTMLButtonElement>('[data-testid*="retry"], [data-testid*="regenerate"]')) {
                console.log("[handleConvStream] Encountered a retry type button");
            }
        }
        if (!conversationId) {
            // try immediate match first
            conversationId = window.location.href.match(/\/c\/([A-Za-z0-9\-_]+)/)?.[1] ?? "";

            // if still empty, wait up to 5s (poll every 100 ms)
            if (!conversationId) {
                const start = Date.now();
                while (!conversationId && Date.now() - start < 5000) {
                    await new Promise((r) => setTimeout(r, 100));
                    conversationId = window.location.href.match(/\/c\/([A-Za-z0-9\-_]+)/)?.[1] ?? "";
                }
            }

            if (conversationId) {
                addChatToDeleteLS(conversationId);
            } else {
                console.warn("[handleConvStream] Could not find conversation ID");
            }
        }
        currentChatIdRef.current = conversationId;
        // if (chunkNdx % 2 == 0 && !didIt.current.has(chunkNdx)) {
        //     didIt.current.add(chunkNdx);
        //     await retryFlow(chunkNdx);
        // }
        if (chunkNdx === null) {
            console.warn("[handleConvStream] chunkNdx is null");
            return;
        }
        if (stopFlow.current) audioIssueStop.current = false;
        if (audioIssueStop.current) {
            // Since we stopped the current chunkNdx, it will need to be re-injected
            audioIssueInjections.current.add(chunkNdx);
            // Convert to array and sort ascending
            const sorted = Array.from(audioIssueInjections.current).sort((a, b) => a - b);

            // Take the first (lowest) element
            const first = sorted[0];

            console.warn(`[audioIssueInjections] Injecting audio for chunk ${first}`);

            // Inject using the first element
            injectPrompt(
                chunkRef.current[first].text,
                chunkRef.current[first].id,
                promptNdx.current
            );

            // Remove it from the set
            audioIssueInjections.current.delete(first);
            audioIssueStop.current = false;
            stopFlow.current = true;
            return;
        }
        if (!stopFlow.current && chunkNdx !== nextChunkRef.current - 1) {
            // if its not part of the stop flow or the main flow then force it to be on the main flow
            console.warn("[handleConvStream] Chunk fund to be in neither stop or main flow, retrying:", chunkNdx);
            await retryFlow(nextChunkRef.current - 1);
            return;
        }
        if (stopConvo) {
            console.warn ('[handleConvStream] stopConvo detected');
            localStorage.setItem(
                "gptr/abortCount",
                String((Number(localStorage.getItem("gptr/abortCount")) || 1) + 1)
            );
            await retryFlow(chunkNdx);
            return;
        }

        // define needed consts
        const actual = assistant ? assistant : target;
        const comparisonActual = normalizeAlphaNumeric(actual);
        const comparisonExpected = target;
        // console.log('This is the actual message: ', comparisonActual);
        // console.log('This is the expected message: ', comparisonExpected);
        

        // ——— copyright/inappropriateness detection ———
        if (
            actual.length < 80 &&
            (actual.includes("I cannot") || actual.includes("I can't") || actual.includes("sorry") || actual.includes("assist"))
        ) {
            if ((retryCounts.current[chunkNdx] ?? 0) < MAX_RETRIES) {
                console.warn("[handleConvStream] Text is being deemed as inappropriate by ChatGPT due to copyright or language issues.");
                await retryFlow(chunkNdx);
                return;
            }
            handleErrorWithNoFetch("Your text is being deemed as inappropriate by ChatGPT due to copyright or language issues, please adjust and re-upload your text.");
            return;
        }
        
        if (comparisonActual !== comparisonExpected && !localStorage.getItem("gptr/equalIssue")) {
            console.warn("[handleConvStream] Message mismatch detected between actual and expected. Retrying…");
            if ((retryCounts.current[chunkNdx] ?? 0) >= (MAX_RETRIES - 1)) {
                localStorage.setItem("gptr/equalIssue", "true");
            } else {
                await retryFlow(chunkNdx);
                return;
            }
        }

        // Compute the last conversation turn element and ensure it's an assistant turn.
        // Then, within that assistant turn, get the FIRST data-message-id (poll up to 3s in both steps).
        const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

        let domMessageId: string | null | undefined = null;

        // helper: poll for up to `ms` until fn() returns a truthy value
        const poll = async <T>(fn: () => T | null | undefined, ms = 3000, interval = 100): Promise<T | null> => {
            const end = Date.now() + ms;
            while (Date.now() < end) {
                const val = fn();
                if (val) return val;
                await new Promise(r => setTimeout(r, interval));
            }
            return null;
        };

        // 1) Get the last node whose test id starts with conversation-turn-
        const getLastTurn = (): HTMLElement | null => {
            const nodes = document.querySelectorAll<HTMLElement>('[data-testid^="conversation-turn-"]');
            if (!nodes.length) return null;
            return nodes[nodes.length - 1]!;
        };

        let lastTurnEl = getLastTurn();

        // If the last turn is not an assistant turn, poll up to 3s for a new last assistant turn to appear
        if (!lastTurnEl || lastTurnEl.getAttribute("data-turn") !== "assistant") {
            lastTurnEl = await poll<HTMLElement>(() => {
                const el = getLastTurn();
                return el && el.getAttribute("data-turn") === "assistant" ? el : null;
            }, 5000, 100);
            if (!lastTurnEl) {
                console.warn("[handleConvStream] No assistant turn appeared within 3s; retrying…");
                await retryFlow(chunkNdx);
                return;
            }
        }

        // 2) Within the assistant turn, get the FIRST data-message-id (poll up to 3s)
        const findFirstMessageId = (): string | null => {
            // Be permissive: grab the first element carrying data-message-id inside this turn.
            const elWithMsg = lastTurnEl!.querySelector<HTMLElement>("[data-message-id]");
            return elWithMsg?.getAttribute("data-message-id") ?? null;
        };

        domMessageId = findFirstMessageId();
        if (!domMessageId) {
            domMessageId = await poll<string>(() => findFirstMessageId(), 3000, 100);
            if (!domMessageId) {
                console.warn("[handleConvStream] No message id found within 3s; retrying…");
                await retryFlow(chunkNdx);
                return;
            }
        }

        // If we got a valid domMessageId different from the streamed one, prefer DOM
        if (domMessageId && domMessageId !== messageId && uuidRe.test(domMessageId)) {
            console.warn("Using DOM message id instead of streamed id:", messageId, "→", domMessageId);
            messageId = domMessageId;
        }

        // // make sure we have the right conversation id
        // let convMatch = window.location.href.match(/\/c\/([A-Za-z0-9\-_]+)/);
        // let urlConvId = convMatch?.[1] ?? "";
        // if (!urlConvId) {
        //     console.warn("Couldn't find conversation id in url");
        // }
        // if (urlConvId && urlConvId !== conversationId && uuidRe.test(urlConvId)) {
        //     console.warn("Got the wrong conversation id. Falling back to id in url");
        //     conversationId = urlConvId;
        // }

        let waitTime = 10000;
        // —— Wait together for send/composer/suffix using the resolved domMessageId ——
        try {
            const comparisonSuffix = normalizeAlphaNumeric(comparisonExpected).slice(-10);
            const targetSelector = `[data-message-id='${domMessageId}']`;

            // Promise that resolves when suffix appears in the specific assistant message
            const suffixPromise = new Promise<void>((resolve) => {
                const check = async () => {
                    const end = Date.now() + waitTime;
                    while (Date.now() < end) {
                        const el = document.querySelector<HTMLElement>(targetSelector);
                        if (el) {
                            const text = normalizeAlphaNumeric(el.textContent || "");
                            if (text.includes(comparisonSuffix)) {
                                if (LOCAL_LOGS)console.log('SUFFIX WON THE RACE');
                                resolve();
                                return;
                            }
                        }
                        await new Promise(r => setTimeout(r, 100));
                    }
                };
                check();
            });

            // Promise for the composer button
            const composerPromise = waitForElement("[data-testid='composer-speech-button']", waitTime);
            // Promise for the send button
            const sendPromise = waitForElement("[data-testid='send-button']", waitTime);

            // Race all three at once
            await Promise.race([composerPromise, sendPromise, suffixPromise]);

            // Click stop button if suffixPromise wins the race
            const stopBtn = document.querySelector<HTMLButtonElement>("[data-testid='stop-button']");
            if (stopBtn) {
                stopBtn.click();
            }
        } catch {
            console.warn("No trigger (button or suffix) appeared within", waitTime);
            await retryFlow(chunkNdx);
            return;
        }

        localStorage.setItem("gptr/abortCount", "1");

        if (chunkNdx !== null && chunkNdx >= 0 && chunkNdx < chunkRef.current.length) {
            // Prefetch audio in the background; out-of-order is fine
            if (token) {
                if (audioIssueInjections.current.size > 0) {
                    // Convert to array and sort ascending
                    const sorted = Array.from(audioIssueInjections.current).sort((a, b) => a - b);

                    // Take the first (lowest) element
                    const first = sorted[0];

                    console.warn(`[audioIssueInjections] Injecting audio for chunk ${first}`);

                    // Inject using the first element
                    injectPrompt(
                        chunkRef.current[first].text,
                        chunkRef.current[first].id,
                        promptNdx.current
                    );

                    // Remove it from the set
                    audioIssueInjections.current.delete(first);
                    stopFlow.current = true;
                } else {
                    if (LOCAL_LOGS) console.log(`[Audio Fetch] Setting current completed stream for ${chunkNdx}`);
                    // The hope is that the biggest chunkNdx in audioIssueInjections is from the mainline
                    setCurrentCompletedStream({ messageId, conversationId, createTime, text, chunkNdx });
                    stopFlow.current = false;
                }
                const storedFormat = format.toLowerCase();
                if (LOCAL_LOGS) console.log(`[Audio Prefetch] Prefetching audio for chunk ${chunkNdx}`);
                (async () => {
                    try {
                        const convKey = `${conversationId}:${messageId}`;
                        registerPending(conversationId, convKey);
                        const audioUrl = await fetchAndDecodeAudio(
                            `${SYNTHESIZE_ENDPOINT}?conversation_id=${conversationId}&message_id=${messageId}&voice=${voices.selected ?? VOICE}&format=${storedFormat}`,
                            +chunkNdx,
                            conversationId,
                            messageId
                        );
                        if (audioUrl) {
                            setCompletedStreams((streams) => {
                                const ordered = [...streams];
                                ordered[chunkNdx] = audioUrl;
                                return ordered;
                            });
                        } 
                    } catch {
                        handleErrorWithNoFetch("ChatGPT seems to be having issues finding the audio, please click the back button on the top-left or close the overlay and try again.");
                    }
                })();
            }
        }
        setIsLoading(false);
    }, [retryCounts, retryFlow, fetchAndDecodeAudio, setCompletedStreams, setCurrentCompletedStream, handleError, setIsLoading, voices.selected, token, format]);

    const handleRateLimitExceeded = useCallback(async (e: Event) => {
        const { detail } = e as CustomEvent<{ message: string; chunkNdx?: number }>;
        const failing = detail.chunkNdx ?? (nextChunkRef.current - 1);
        
        console.error('In hadleRateLimitExceeded:', detail);
        if ((retryCounts.current[failing] ?? 0) < MAX_RETRIES) {
            await retryFlow(failing);
            return;
        }
        
        toast({ description: detail.message, style: TOAST_STYLE_CONFIG });
        setIsLoading(false);
    }, [nextChunkRef, retryCounts, retryFlow, toast, setIsLoading]);

    const reset = () => {
        setCompletedStreams([]);
        setCurrentCompletedStream(null);
        setBlobs([]);
        retryCounts.current = {};
        lastRegularRetryChunk.current.clear();
        promptNdx.current = 0;
        audioIssueInjections.current.clear();
        stopFlow.current = false;
        audioIssueStop.current = false;
        didIt.current.clear();
        chatToPendingRef.current.clear();
    }
    
    useEffect(() => {
        setError(null);
        window.addEventListener(LISTENERS.END_OF_STREAM, handleConvStream);
        window.addEventListener(LISTENERS.RATE_LIMIT_EXCEEDED, handleRateLimitExceeded);
        window.addEventListener(LISTENERS.GENERAL_ERROR, handleRateLimitExceeded);
        return () => {
            window.removeEventListener(LISTENERS.END_OF_STREAM, handleConvStream);
            window.removeEventListener(LISTENERS.RATE_LIMIT_EXCEEDED, handleRateLimitExceeded);
            window.removeEventListener(LISTENERS.GENERAL_ERROR, handleRateLimitExceeded);
        };
    }, [handleConvStream, handleRateLimitExceeded]);

    return { isFetching, completedStreams, currentCompletedStream, reset, error, voices, setVoices, isVoiceLoading, blobs, promptNdx }

}

export default useStreamListener;