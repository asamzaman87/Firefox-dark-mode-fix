import { FREE_DOWNLOAD_CHUNKS, LISTENERS, LOCAL_LOGS, SYNTHESIZE_ENDPOINT, TOAST_STYLE_CONFIG, TOAST_STYLE_CONFIG_INFO, VOICE } from "@/lib/constants";
import { useCallback, useEffect, useRef, useState } from "react";
import useAuthToken from "./use-auth-token";
import { useToast } from "./use-toast";
import useVoice from "./use-voice";
import { Chunk, deleteChatAndCreateNew, handleError, normalizeAlphaNumeric, waitForElement } from "@/lib/utils";
import useFormat from "./use-format";
import { usePremiumModal } from "@/context/premium-modal";
const MAX_RETRIES = 2; 
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

    // LocalStorage list so Uploader can also clean these up
    const LS_CHATS_TO_DELETE = "gptr/chatsToDelete";
    const readChatsToDelete = (): string[] => {
        try { return JSON.parse(localStorage.getItem(LS_CHATS_TO_DELETE) || "[]"); } catch { return []; }
    };
    const writeChatsToDelete = (ids: string[]) => {
        localStorage.setItem(LS_CHATS_TO_DELETE, JSON.stringify([...new Set(ids)]));
    };
    const addChatToDeleteLS = (chatId: string) => {
        const list = readChatsToDelete();
        if (!list.includes(chatId)) writeChatsToDelete([...list, chatId]);
    };
    const removeChatFromDeleteLS = (chatId: string) => {
        writeChatsToDelete(readChatsToDelete().filter(id => id !== chatId));
    };

    const registerPending = (chatId: string, convKey: string) => {
        let set = chatToPendingRef.current.get(chatId);
        if (!set) {
            set = new Set<string>();
            chatToPendingRef.current.set(chatId, set);
        }
        set.add(convKey);
    };

    const completePending = (chatId: string, convKey: string) => {
        const set = chatToPendingRef.current.get(chatId);
        if (set) {
            set.delete(convKey);
            if (set.size === 0) {
                chatToPendingRef.current.delete(chatId);
                // not the current chat? try to delete now (fallback to LS)
                if (chatId !== currentChatIdRef.current) {
                    maybeDeleteChat(chatId);
                }
            }
        }
    };

    // Use shared util; no duplicate delete logic here
    const maybeDeleteChat = async (chatId: string) => {
        try {
            const res = await deleteChatAndCreateNew(false, chatId);
            if (res?.ok) {
                removeChatFromDeleteLS(chatId);
            } else {
                addChatToDeleteLS(chatId);
            }
        } catch {
            addChatToDeleteLS(chatId);
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
        async (failedChunkNdx: number, conversationId?: string, convKey?: string) => {
            if (conversationId && convKey) {
                completePending(conversationId, convKey);
            }

            if (failedChunkNdx < 0 || failedChunkNdx >= chunkRef.current.length) {
                if (LOCAL_LOGS) console.log("[retryFlow] invalid chunk index", failedChunkNdx);
                return;
            }

            // bump counter (kept for telemetry/visibility even though we don't cap in fetch path)
            retryCounts.current[failedChunkNdx] = (retryCounts.current[failedChunkNdx] ?? 0) + 1;

            // record current chat so it can be cleaned later
            const prevChatId = window.location.href.match(/\/c\/([A-Za-z0-9\-_]+)/)?.[1] || null;

            // open a new chat (do not delete old one here)
            await new Promise<void>(async (resolve) => {
                const newChatBtn = document.querySelector<HTMLButtonElement>(
                    "[data-testid='create-new-chat-button'], [aria-label='New chat']"
                );
                if (newChatBtn) {
                    newChatBtn.click();
                }
                // wait briefly for the new chat URL
                for (let i = 0; i < 10; i++) {
                    await new Promise((r) => setTimeout(r, 200));
                    const urlChat = window.location.href.match(/\/c\/([A-Za-z0-9\-_]+)/)?.[1];
                    if (urlChat) break;
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

            // queue old chat for deletion
            if (prevChatId) addChatToDeleteLS(prevChatId);
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
                while (Date.now() - start < 1500) {
                    await new Promise((r) => setTimeout(r, 300));
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

            completePending(conversationId, convKey);
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
            if (nextChunkRef.current === chunkRef.current.length) {
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
                
                stopFlow.current = true;
            } else if (!stopFlow.current) {
                localStorage.setItem('gptr/abort', 'true');
                audioIssueStop.current = true;
                console.log('gptr/abort SET FOR CHUNK NUMBER:', chunkNumber);
            }
            return;
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

        if (!stopConvo) {
            const stopButton = document.querySelector<HTMLButtonElement>("[data-testid='stop-button']");
            if (stopButton) {
                stopButton.click();
            }
        } 

        // Compute the last assistant conversation turn by counting turns (1=user, 2=assistant, 3=user, 4=assistant, ...)
        // Then get the FIRST assistant message id within that last assistant turn.
        const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

        let domMessageId: string | null | undefined;

        const turnNodes = document.querySelectorAll<HTMLElement>('[data-testid^="conversation-turn-"]');
        if (turnNodes.length > 0) {
            // if total turns is even → last assistant turn is N; if odd → N-1
            const lastAssistantTurnN = (turnNodes.length % 2 === 0) ? turnNodes.length : (turnNodes.length - 1);
            let turnElement: HTMLElement | null = null;
            for (let i = 0; i < 5 && !turnElement; i++) { // up to ~250ms total
                turnElement = document.querySelector<HTMLElement>(`[data-testid="conversation-turn-${lastAssistantTurnN}"]`);
                if (!turnElement) await new Promise(r => setTimeout(r, 50));
            }

            if (turnElement) {
                const asm = turnElement.querySelector<HTMLDivElement>('[data-message-author-role="assistant"][data-message-id]');
                domMessageId = asm?.getAttribute('data-message-id') || null;
            } else {
                console.warn("Couldn't locate last assistant conversation turn element");
            }
        }

        if (domMessageId && domMessageId !== messageId && uuidRe.test(domMessageId)) {
            console.warn("Got the wrong message id. Falling back to DOM id:", messageId, "→", domMessageId);
            messageId = domMessageId;
        }

        // make sure we have the right conversation id
        let convMatch = window.location.href.match(/\/c\/([A-Za-z0-9\-_]+)/);
        let urlConvId = convMatch?.[1] ?? "";
        if (!urlConvId) {
            console.warn("Couldn't find conversation id in url");
        }
        if (urlConvId && urlConvId !== conversationId && uuidRe.test(urlConvId)) {
            console.warn("Got the wrong conversation id. Falling back to id in url");
            conversationId = urlConvId;
        }

        // mark the current chat so we never delete it here
        currentChatIdRef.current = conversationId;
        const convKey = `${conversationId}:${messageId}`;
        registerPending(conversationId, convKey);

        // wait for the speech button in chrome and send in firefox after stopping
        try {
            await Promise.race([
                waitForElement("[data-testid='composer-speech-button']", 3000),
                waitForElement("[data-testid='send-button']", 3000),
            ]);
        } catch {
            console.warn("No resume button appeared within 3s; retrying if not the last chunk");
            if (chunkNdx != null && chunkNdx < chunkRef.current.length - 1) {
                await retryFlow(chunkNdx, conversationId, convKey);
                return;
            }
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
                await retryFlow(chunkNdx, conversationId, convKey);
                return;
            }
            handleErrorWithNoFetch("Your text is being deemed as inappropriate by ChatGPT due to copyright or language issues, please adjust and re-upload your text.");
            return;
        }
        
        
        if (comparisonActual !== comparisonExpected) {
            await retryFlow(chunkNdx, conversationId, convKey);
            return;
        } 
        
        
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