import { AUDIO_FORMAT, GPT_BREAKER, LISTENERS, SYNTHESIZE_ENDPOINT, TOAST_STYLE_CONFIG, TOAST_STYLE_CONFIG_INFO, VOICE } from "@/lib/constants";
import { useCallback, useEffect, useRef, useState } from "react";
import useAuthToken from "./use-auth-token";
import { TOAST_REMOVE_DELAY, useToast } from "./use-toast";
import useVoice from "./use-voice";
import { Chunk, normalizeAlphaNumeric, waitForElement } from "@/lib/utils";
const MAX_RETRIES = 3; 
const useStreamListener = (
    setIsLoading: (state: boolean) => void,
    nextChunkRef: React.MutableRefObject<number>,                      
    chunkRef: React.MutableRefObject<Chunk[]>,                            
    injectPrompt: (text: string, id: string, ndx: number) => void,            
  ) => {
    const { toast } = useToast();
    const [completedStreams, setCompletedStreams] = useState<string[]>([]);
    const [currentCompletedStream, setCurrentCompletedStream] = useState<{ messageId: string, conversationId: string, createTime: number, text: string, chunkNdx: number } | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isFetching, setIsFetching] = useState<boolean>(false);
    const { token } = useAuthToken();
    const { voices, handleVoiceChange, isLoading: isVoiceLoading } = useVoice();
    const [blobs, setBlobs] = useState<{ chunkNumber: number; blob: Blob }[]>([]);

    const retryCounts = useRef<Record<number, number>>({});
    const lastRegularRetryChunk = useRef<number | null>(null);
    const promptNdx = useRef<number>(0);
    
    const setVoices = (voice: string) => {
        handleVoiceChange(voice);
    }

    const handleError = (error: string, duration: number = TOAST_REMOVE_DELAY) => {
        const errorEvent = new CustomEvent(LISTENERS.ERROR, { detail: { message: error} });
        window.dispatchEvent(errorEvent);
        toast({ description: error, style: TOAST_STYLE_CONFIG, duration });
        setIsFetching(false);
        return
    }

    const retryFlow = useCallback(
        async () => {
          const idx = nextChunkRef.current - 1;
          if (idx < 0 || idx >= chunkRef.current.length) {
            console.log("Retry failed: invalid chunk index");
            return;
          }
          
          retryCounts.current[idx] = (retryCounts.current[idx] ?? 0) + 1;
      
          let storedChatId = window.location.href.match(/\/c\/([A-Za-z0-9\-_]+)/)?.[1];
          // If not found, wait up to 5 seconds (poll every 500ms) for the URL to include it:
          if (!storedChatId) {
            for (let i = 0; i < 10; i++) {
                await new Promise((res) => setTimeout(res, 500));
                storedChatId = window.location.href.match(/\/c\/([A-Za-z0-9\-_]+)/)?.[1];
                if (storedChatId) {
                    break;
                }
            }
            if (!storedChatId) {
                console.warn(
                    "Could not detect conversation ID in URL after waiting. Skipping deletion."
                );
            }
          }
      
          // If found, delete the conversation 
          if (storedChatId) {
            // We’ll turn the AUTH_RECEIVED + PATCH flow into a promise we can await
            await new Promise<void>(async (resolve) => {
              const newChatBtn = document.querySelector<HTMLButtonElement>(
                "[data-testid='create-new-chat-button'], [aria-label='New chat']"
              );
              if (newChatBtn){
                newChatBtn.click();
              } 
              // 1) ask for the token
              window.dispatchEvent(new Event("GET_TOKEN"));
      
              // 2) when AUTH_RECEIVED comes in, do the PATCH and then resolve()
              const deleteHandler = async (e: Event) => {
                const ce = e as CustomEvent<{ accessToken: string }>;
                const token = ce.detail.accessToken;
                if (token) {
                  try {
                    await fetch(
                      `https://chatgpt.com/backend-api/conversation/${storedChatId}`,
                      {
                        method: "PATCH",
                        headers: {
                          "Content-Type": "application/json",
                          Authorization: `Bearer ${token}`,
                        },
                        body: JSON.stringify({ is_visible: false }),
                      }
                    );
                  } catch (err) {
                    console.error(err);
                  }
                }
                window.removeEventListener("AUTH_RECEIVED", deleteHandler);
                resolve(); // notify that delete+new‐chat click are complete
              };
      
              window.addEventListener("AUTH_RECEIVED", deleteHandler, { once: true });
            });
          }
      
          // Now we know the delete (and “New Chat” click) has finished
          let { text, id } = chunkRef.current[idx];
          promptNdx.current += 1;
          toast({ description: `GPT Reader is configuring ChatGPT, please wait a few seconds for the next audio chunk...`, style: TOAST_STYLE_CONFIG_INFO, duration: 10000 });
          injectPrompt(text, id, promptNdx.current);
        },
        [chunkRef, injectPrompt, nextChunkRef]
      );
      
    const fetchAndDecodeAudio = useCallback(async (url: string, chunkNumber: number) => {
        setIsFetching(true);
        // ——— ensure we have a valid token ———
        let authToken = token;
        if (!authToken) {
            // ask the page for it…
            window.dispatchEvent(new Event("GET_TOKEN"));

            // …and wait up to 15 s for AUTH_RECEIVED
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
                handleError("GPT Reader is having issues finding the audio. Please refresh the page and try again.");
                return null;
            });

            if (!authToken) return;
        }
        let response: Response | undefined;
        try {
            response = await fetch(url, { headers: { "authorization": `Bearer ${authToken}` } });
        } catch {
            const start = Date.now();
            while (Date.now() - start < 1500) {
                await new Promise((r) => setTimeout(r, 300));
                response = await fetch(url, { headers: { "authorization": `Bearer ${authToken}` } });
                if (response.status === 200) {
                    break
                }
            }
            if (!response) {
                throw new Error("Failed to fetch audio after retries");
            }
        }
        
        if (response.status === 404) {
            const start = Date.now();
            while (Date.now() - start < 1500) {
                await new Promise((r) => setTimeout(r, 300));
                response = await fetch(url, { headers: { "authorization": `Bearer ${authToken}` } });
                if (response.status === 200) {
                    break
                }
            }
        }
        if (response.status !== 200) {
            if (lastRegularRetryChunk.current !== chunkNumber && response.status !== 404) {
                lastRegularRetryChunk.current = chunkNumber;
                await new Promise((res) => setTimeout(res, 500));
                return await retry(url, chunkNumber);
            }
            if ((retryCounts.current[chunkNumber] ?? 0) < MAX_RETRIES) {
                await retryFlow();
                return;
            }
        }
        if (response.status !== 200) {
            if (response.status === 429) {
                handleError("You have exceeded the hourly limit for your current ChatGPT model. Please switch to another model to continue using GPT Reader or wait a few minutes.", Infinity);
                return
            }
            handleError("ChatGPT seems to be having issues finding the audio, please click the back button on the top-left or close the overlay and try again.");
            return;
        }
        let blob: Blob;
        try {
            blob = await response.blob();
        } catch (err) {
            console.warn(`Audio blob read failed for chunk ${chunkNumber}, retrying…`, err);
            // simple back‐off
            await new Promise((r) => setTimeout(r, 300));
            // use your existing retry helper
            return await retry(url, chunkNumber);
        }
        setBlobs(bs => {
            const exists = bs.some(b => b.chunkNumber === chunkNumber);
            if (exists) {
                // Don't append duplicate blob
                return bs;
            }
            return [...bs, { chunkNumber, blob }];
        });
        const audioUrl = URL.createObjectURL(blob);
        setIsFetching(false);
        return audioUrl;
    }, [token, retryFlow])

    //retry fetching audio
    const retry = useCallback(async (url: string, chunkNumber: number): Promise<string | undefined> => {
        return await fetchAndDecodeAudio(url, chunkNumber);
    }, [token])

    const handleConvStream = useCallback(async (e: Event) => {
        let { detail: { messageId, conversationId, text, createTime, chunkNdx, assistant, stopConvo } } = e as Event & { detail: { conversationId: string, messageId: string, createTime: number, text: string, chunkNdx: number, assistant: string, stopConvo: boolean } };
        if (!stopConvo) {
            const stopButton = document.querySelector<HTMLButtonElement>("[data-testid='stop-button']");
            if (stopButton) {
                stopButton.click();
            }
        } 
        // wait for the speech button in chrome and send in firefox after stopping
        try {
            await Promise.race([
                waitForElement("[data-testid='composer-speech-button']", 3000),
                waitForElement("[data-testid='send-button']", 3000),
            ]);
        } catch {
            console.warn("No resume button appeared within 3s; retrying if not the last chunk");
            if (chunkNdx < chunkRef.current.length - 1) {
                await retryFlow();
                return;
            }
        }
        
        // make sure we have the right message id
        const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        const turnNumber = (chunkNdx + 1) * 2;  // chunk 0 → turn 2, chunk 1 → turn 4, etc.
        const turnElement = document.querySelector<HTMLElement>(
            `[data-testid="conversation-turn-${turnNumber}"]`
        );
        let domMessageId: string | null | undefined;
        if (turnElement) {
            const asm = turnElement.querySelector<HTMLDivElement>(
                '[data-message-author-role="assistant"]'
            );
            domMessageId = asm?.getAttribute('data-message-id');
        } else {
            console.warn("Couldn't find DOM message id");
        }
        if (domMessageId && domMessageId !== messageId && uuidRe.test(domMessageId)) {
            console.warn(
                "Got the wrong message id. Falling back to DOM id:",
                messageId,
                "→",
                domMessageId
            );
            messageId = domMessageId;
        } 
        // make sure we have the right conversation id
        let convMatch = window.location.href.match(/\/c\/([A-Za-z0-9\-_]+)/);
        let urlConvId = convMatch?.[1] ?? "";
        if (urlConvId && urlConvId !== conversationId && uuidRe.test(urlConvId)) {
            console.warn("Got the wrong conversation id. Falling back to id in url");
            conversationId = urlConvId;
        }
        // define needed consts
        const expected = chunkRef.current[chunkNdx].text;
        const actual = assistant ? assistant : expected;
        const comparisonActual = normalizeAlphaNumeric(actual);
        const comparisonExpected = normalizeAlphaNumeric(expected);
        // console.log('This is the actual message: ', comparisonActual);
        // console.log('This is the expected message: ', comparisonExpected);
        

        // ——— copyright/inappropriateness detection ———
        if (
            actual.length < 80 &&
            (actual.includes("I cannot") || actual.includes("I can't") || actual.includes("sorry") || actual.includes("assist"))
        ) {
            if ((retryCounts.current[chunkNdx] ?? 0) < MAX_RETRIES) {
                await retryFlow();
                return;
            }
            handleError("Your text is being deemed as inappropriate by ChatGPT due to copyright or language issues, please adjust and re-upload your text.");
            return;
        }
        
        
        if (comparisonActual !== comparisonExpected) {
            await retryFlow();
            return;
        } 
        
        
        if (chunkNdx !== null && chunkNdx >= 0 && chunkNdx < chunkRef.current.length) {
            if (token) {
                try {
                    // prefetching audio
                    const audioUrl = await fetchAndDecodeAudio(
                        `${SYNTHESIZE_ENDPOINT}?conversation_id=${conversationId}&message_id=${messageId}&voice=${voices.selected ?? VOICE}&format=${AUDIO_FORMAT}`,
                        +chunkNdx
                    );
                    
                    // ignore as null returns would be from retries
                    if (!audioUrl) {
                      return;
                    }

                    if (audioUrl) {
                        setCompletedStreams((streams) => {
                            const ordered = [...streams];
                            ordered[chunkNdx] = audioUrl;
                            return ordered;
                        });
                    } else {
                        console.warn(`[Audio Prefetch] Failed to fetch audio for chunk ${chunkNdx}`);
                    }
                } catch {
                    handleError("ChatGPT seems to be having issues finding the audio, please click the back button on the top-left or close the overlay and try again.");
                    return;
                }
            }
            setCurrentCompletedStream({ messageId, conversationId, createTime, text, chunkNdx })
        }
        setIsLoading(false);
    }, [retryCounts, retryFlow, fetchAndDecodeAudio, setCompletedStreams, setCurrentCompletedStream, handleError, setIsLoading, voices.selected, token]);

    const handleRateLimitExceeded = useCallback(async (e: Event) => {
        const { detail } = e as Event & { detail: string };
        if ((retryCounts.current[nextChunkRef.current - 1] ?? 0) < MAX_RETRIES) {
            await retryFlow();
            return;
        }
        toast({ description: detail, style: TOAST_STYLE_CONFIG });
        setIsLoading(false);
    }, [nextChunkRef, retryCounts, retryFlow, toast, setIsLoading]);

    const reset = () => {
        setCompletedStreams([]);
        setCurrentCompletedStream(null);
        setBlobs([]);
        retryCounts.current = {};
        lastRegularRetryChunk.current = null;
        promptNdx.current = 0;
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