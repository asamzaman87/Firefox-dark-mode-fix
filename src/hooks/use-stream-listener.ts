import { AUDIO_FORMAT, EXTREME_HELPER_PROMPT, LISTENERS, SYNTHESIZE_ENDPOINT, TOAST_STYLE_CONFIG, VOICE } from "@/lib/constants";
import { useCallback, useEffect, useRef, useState } from "react";
import useAuthToken from "./use-auth-token";
import { TOAST_REMOVE_DELAY, useToast } from "./use-toast";
import useVoice from "./use-voice";
import { Chunk } from "@/lib/utils";
const MAX_RETRIES = 5; 
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
    const msgNum = useRef<number>(0);

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
            await new Promise<void>((resolve) => {
              const newChatBtn = document.querySelector<HTMLButtonElement>(
                "[data-testid='create-new-chat-button'], [aria-label='New chat']"
                );
              if (newChatBtn){
                msgNum.current = 0;
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
          const { text, id } = chunkRef.current[idx];
          injectPrompt(text, id, retryCounts.current[idx] - 1);
        },
        [chunkRef, injectPrompt, nextChunkRef]
      );
      
    const fetchAndDecodeAudio = useCallback(async (url: string, chunkNumber: number) => {
        setIsFetching(true);
        const response = await fetch(url, { headers: { "authorization": `Bearer ${token}` } });
        if (response.status !== 200) {
            if (lastRegularRetryChunk.current !== chunkNumber) {
                lastRegularRetryChunk.current = chunkNumber;
                return retry(url, chunkNumber);
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
        const blob = await response.blob();
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
    }, [token, blobs, retryFlow])

    //retry fetching audio
    const retry = useCallback(async (url: string, chunkNumber: number): Promise<string | undefined> => {
        return await fetchAndDecodeAudio(url, chunkNumber);
    }, [token])

    const handleConvStream = useCallback(async (e: Event) => {
        const { detail: { messageId, conversationId, text, createTime, chunkNdx } } = e as Event & { detail: { conversationId: string, messageId: string, createTime: number, text: string, chunkNdx: number } };
        // <<< ADDED: detect refusal and bail before fetching audio
        let actual = "";
        // locate the specific assistant turn by its test-id
        const turnNumber = msgNum.current * 2 + 2;
        const turnEl = document.querySelector<HTMLElement>(
            `[data-testid="conversation-turn-${turnNumber}"]`
        );
        if (turnEl) {
            actual = turnEl.innerText.replace(/^ChatGPT said:\s*/, "");
        }

        actual = actual.replace(/\s+/g, " ").trim();
        // console.log('This is the actual message: ', actual);

        if (
            actual.length < 150 &&
            (actual.includes("I cannot") || actual.includes("I can't"))
        ) {
            if ((retryCounts.current[chunkNdx] ?? 0) < MAX_RETRIES) {
                await retryFlow();
                return;
            }
            handleError("Your text is being deemed as inappropriate by ChatGPT due to copyright or language issues, please adjust and re-upload your text.");
            return;
        }

        // ——— size‐mismatch detection ———
        if (chunkNdx >= 0 && chunkNdx < chunkRef.current.length) {
            // normalize whitespace and grab the “expected” chunk text
            const expected = chunkRef.current[chunkNdx].text
                .replace(/\s+/g, " ")
                .trim();
            // console.log('This is the expected message: ', expected);
            const expectedLen = expected.length;
            const actualLen = actual.length;
            // allow a 10% char tolerance
            const threshold = (expectedLen * 0.10);
            if (Math.abs(actualLen - expectedLen) > threshold) {
                // retry if we haven’t hit MAX_RETRIES yet
                if ((retryCounts.current[chunkNdx] ?? 0) < MAX_RETRIES) {
                    await retryFlow();
                    return;
                }
                // otherwise show an error
                handleError(
                    `ChaGPT is having issues with reading your text. Please try again in a few minutes and let us know if the issue persists through the feedback icon.`
                );
                return;
            }
        }
          

        if (chunkNdx !== null && chunkNdx >= 0 && chunkNdx < chunkRef.current.length) {
            if (token) {
                try {
                    // prefetching audio
                    const audioUrl = await fetchAndDecodeAudio(
                        `${SYNTHESIZE_ENDPOINT}?conversation_id=${conversationId}&message_id=${messageId}&voice=${voices.selected ?? VOICE}&format=${AUDIO_FORMAT}`,
                        +chunkNdx
                    );
                    
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
            msgNum.current += 1;
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
        msgNum.current = 0;
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
    }, [handleConvStream]);

    return { isFetching, completedStreams, currentCompletedStream, reset, error, voices, setVoices, isVoiceLoading, blobs }

}

export default useStreamListener;