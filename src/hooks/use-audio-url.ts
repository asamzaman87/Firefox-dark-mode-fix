/* eslint-disable @typescript-eslint/no-explicit-any */
import { CHUNK_SIZE, CHUNK_TO_PAUSE_ON, FRAME_MS, HELPER_PROMPTS, LISTENERS, MIN_SILENCE_MS, LOCAL_LOGS, PROMPT_INPUT_ID, TOAST_STYLE_CONFIG, TOAST_STYLE_CONFIG_INFO, FREE_DOWNLOAD_CHUNKS } from "@/lib/constants";
import { addChatToDeleteLS, choosePreferredModel, Chunk, cleanAudioBuffer, collectChatsAboveTopChat, computeNoiseFloor, detectBrowser, encodeWav, findNextSilence, handleError, maybeDeleteChat, normalizeAlphaNumeric, splitIntoChunksV2, transcribeWithFallback, waitForAuthToken, waitForEditor, filterTextForTTS } from "@/lib/utils";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import useFileReader, { makeHtmlProgressSlicer } from "./use-file-reader";
import useStreamListener from "./use-stream-listener";
import { useToast } from "./use-toast";
import useFormat from "./use-format";
import { usePremiumModal } from "@/context/premium-modal";
import useAuthToken from "./use-auth-token";

const useAudioUrl = (isDownload: boolean, onSaveDownloadPosition?: (offset: number, endText?: string) => void) => {
    const isCancelledRef = useRef<boolean>(false);
    const audioCtxRef = useRef<AudioContext | null>(null);
    const sessionBaseOffsetRef = useRef<number>(0);
    const fullOriginalTextLengthRef = useRef<number>(0);
    const lastSavedDownloadPositionRef = useRef<number>(-1);
    const calculatedDownloadPositionRef = useRef<number>(-1);
    const lastSavedEndTextRef = useRef<string | undefined>(undefined);
    const onSaveDownloadPositionRef = useRef<((offset: number, endText?: string) => void) | undefined>(onSaveDownloadPosition);
    
    // Keep ref updated when callback changes
    useEffect(() => {
        onSaveDownloadPositionRef.current = onSaveDownloadPosition;
    }, [onSaveDownloadPosition]);

    function getAudioCtx(): AudioContext {
      if (!audioCtxRef.current || audioCtxRef.current.state === "closed") {
        audioCtxRef.current = new (window.AudioContext ||
          (window as any).webkitAudioContext)();
      }
      return audioCtxRef.current;
    }

    const { toast } = useToast();
    const [audioUrls, setAudioUrls] = useState<string[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [text, setText] = useState<string>("");
    const [currentChunkBeingPromptedIndex, setCurrentChunkBeingPromptedIndex] = useState<number>(0);
    const [is9ThChunk, setIs9thChunk] = useState<boolean>(false);
    const [isPromptingPaused, setIsPromptingPaused] = useState<boolean>(false);
    const isPromptingPausedRef = useRef(false);
    useEffect(() => {
        isPromptingPausedRef.current = isPromptingPaused;
    }, [isPromptingPaused]);
    /** Last chunk index whose send button we actually clicked (for fetch-failure vs abort gating). */
    const lastInjectedChunkNdxRef = useRef<number>(-1);
    const [wasPromptStopped, setWasPromptStopped] = useState<"LOADING" | "PAUSED" | "INIT">("INIT");
    const { pdfToText, docxToText, textPlainToText } = useFileReader();
    const [progress, setProgress] = useState<number>(0);
    const [downloadPreviewText, setDownloadPreviewText] = useState<string>();
    // NEW: progressive rich HTML (mirrors downloadPreviewText length)
    const [downloadPreviewHtml, setDownloadPreviewHtml] = useState<string>("");
    const htmlSlicerRef = useRef<null | ((ref: string) => string)>(null);
    // Store original unfiltered text for preview
    const originalTextRef = useRef<string>("");
    // Store original (unfiltered) chunks - these will be filtered on-demand in injectPrompt
    const originalChunksRef = useRef<Chunk[]>([]);
    // Track cumulative original character positions at the start of each chunk
    // chunkStartPositions[i] = cumulative original characters up to (but not including) chunk i
    const chunkStartPositionsRef = useRef<number[]>([]);
    const sendWatchdogIntervalRef = useRef<number | null>(null);
    const sendWatchdogStopRef = useRef<() => void>(() => {});
    const retryCountRef = useRef<number>(0);


    const setPreviewHtmlSource = useCallback((html?: string | null) => {
        if (html && html.trim().length) {
            try {
                htmlSlicerRef.current = makeHtmlProgressSlicer(html);
                setDownloadPreviewHtml("");
            } catch {
                htmlSlicerRef.current = null;
                setDownloadPreviewHtml("");
            }
        } else {
            htmlSlicerRef.current = null;
            setDownloadPreviewHtml("");
        }
    }, []);
    const nextChunkRef = useRef<number>(0);
    const [chunks, setChunks] = useState<Chunk[]>([]);
    const chunkRef = useRef<Chunk[]>([]);
    const chunkNumList = useRef<Set<number>>(new Set());    
    const { isSubscribed, setOpen, setReason } = usePremiumModal();
    const showCompletionToast = useRef<boolean>(false);
    const [showFirstTimeFreeDownloadPopup, setShowFirstTimeFreeDownloadPopup] = useState<boolean>(false);
    // read the user’s chosen format (mp3, aac, or opus)
    const { format } = useFormat();
    const storedFormat = format.toLowerCase();
    // map to the right MIME/codec for MSE and for blob fallbacks
    let mimeCodec: string;
    if (storedFormat === "aac") {
        mimeCodec = 'audio/aac';
    } else if (storedFormat === "opus") {
        mimeCodec = 'audio/ogg';
    } else {
        // default to MP3
        mimeCodec = "audio/mpeg";
    }
    let activeSendObserver: MutationObserver | null = null;
    const { token } = useAuthToken();
    
    const sendWaitCancelRef = useRef<null | (() => void)>(null);
    const latestPromptFlowIdRef = useRef<number>(0);
    const cancelActiveSendArtifacts = () => {
        try { sendWaitCancelRef.current?.(); } catch {}
        sendWaitCancelRef.current = null;
        try { sendWatchdogStopRef.current?.(); } catch {}
        if (activeSendObserver) {
            activeSendObserver.disconnect();
            activeSendObserver = null;
        }
    };
    const sendPrompt = (payload: { text: string; id: string; ndx: number; flowId: number; chunkIndex: number }) => {
        if (payload.flowId !== latestPromptFlowIdRef.current) return;
        setIsLoading(true);
        // 🔹 CANCEL any previous waiter (observer + timeout) before starting a new one
        try { sendWaitCancelRef.current?.(); } catch {}
        sendWaitCancelRef.current = null;

        const clickAndWatch = async (btn: HTMLButtonElement) => {
            if (payload.flowId !== latestPromptFlowIdRef.current) return;
            try { localStorage.setItem("gptr/sended", "true"); } catch {}
            // wait here until doing a local storage get returns a value for it
            while (!localStorage.getItem("gptr/sended")) {
                if (payload.flowId !== latestPromptFlowIdRef.current) return;
                await new Promise((r) => setTimeout(r, 100));
            }
            if (payload.flowId !== latestPromptFlowIdRef.current) return;
            lastInjectedChunkNdxRef.current = payload.chunkIndex;
            btn.click();
            // success path: no more waiting → clear any cancel hook just in case
            sendWaitCancelRef.current?.();
            sendWaitCancelRef.current = null;
            startSendWatchdog(payload);
        };

        const sendButton = document.querySelector("[data-testid='send-button']") as HTMLButtonElement | null;
        if (sendButton && !sendButton.disabled) {
            clickAndWatch(sendButton);
            return;
        }

        // Prevent multiple observers (legacy guard)
        if (activeSendObserver) {
            activeSendObserver.disconnect();
            activeSendObserver = null;
        }

        // ChatGPT re-enables the send button by toggling its `disabled` /
        // `aria-disabled` attribute on the SAME node rather than replacing it.
        // A childList-only observer never sees that, so the wait could time out
        // and report "send button not found" even though the button was clearly
        // active (the rate-limit false positive on retry flows). We now also
        // observe those attribute changes AND keep a lightweight poll as a
        // belt-and-suspenders fallback against any missed mutation.
        let poll: ReturnType<typeof setInterval> | null = null;

        const finishWaiting = () => {
            try { observer.disconnect(); } catch {}
            try { clearTimeout(timeout); } catch {}
            if (poll) { clearInterval(poll); poll = null; }
            activeSendObserver = null;
            sendWaitCancelRef.current = null;
        };

        const tryClickWhenReady = (): boolean => {
            if (payload.flowId !== latestPromptFlowIdRef.current) {
                finishWaiting();
                return true;
            }
            const btn = document.querySelector("[data-testid='send-button']") as HTMLButtonElement | null;
            if (btn && !btn.disabled && btn.getAttribute("aria-disabled") !== "true") {
                finishWaiting();
                clickAndWatch(btn);
                return true;
            }
            return false;
        };

        const observer = new MutationObserver(() => { tryClickWhenReady(); });
        observer.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ["disabled", "aria-disabled"],
        });
        activeSendObserver = observer;

        poll = setInterval(() => { tryClickWhenReady(); }, 250);

        const timeout = setTimeout(() => {
            if (payload.flowId !== latestPromptFlowIdRef.current) return;
            // Final attempt right at the deadline before giving up.
            if (tryClickWhenReady()) return;
            finishWaiting();
            console.error("[sendPrompt] Send button not found after 20 seconds.");
            setIsLoading(false);
            handleError("GPT Reader couldn't reach ChatGPT's send button. You may have hit ChatGPT's hourly limit, or the page needs a refresh. Please refresh the page and open the extension again.");
        }, 20000);

        // 🔹 register a cancel function for THIS waiter
        sendWaitCancelRef.current = finishWaiting;
    };
    
    const stopPrompt = async () => {
        const stopButton: HTMLButtonElement | null = document.querySelector("[data-testid='stop-button']");
        if (stopButton) {
            stopButton.click();
        }
    };

    async function transcribeChunks(file: File) {
      isCancelledRef.current = false;

      toast({
        id: "recording-toast",
        description:
          "This transcript is being generated by ChatGPT. It is not guaranteed to be a 100% accurate and may contain errors or hallucinations if the audio is unclear. Please make sure to review the transcription carefully.",
        className:
          "gpt:max-w-lg gpt:rounded-md gpt:z-[1] gpt:text-wrap gpt:break-words gpt:text-left gpt:text-sm gpt:font-medium gpt:p-4 gpt:text-white gpt:dark:text-black gpt:bg-gray-800 gpt:dark:bg-gray-100 gpt:absolute gpt:top-1/2 gpt:right-1/2 gpt:translate-x-1/2 gpt:-translate-y-34 gpt:opacity-100 gpt:transition-all gpt:ease-in-out",
        duration: 4000,
      });
      // 1) QUICK buffer decode
      const arrayBuffer = await file.arrayBuffer();

      const ctx = getAudioCtx();
      if (ctx.state === "suspended") {
        await ctx.resume();
      }
      const raw = await ctx.decodeAudioData(arrayBuffer);

      const data = raw.getChannelData(0);
      const sr = raw.sampleRate;

      // 2) SILENCE DETECTION on raw PCM
      const noiseFloor = computeNoiseFloor(data, sr);
      const thresh = noiseFloor * 0.8;

      // STREAMING: find each split‐point at the first valid silence ≥ 10s, else hard‐cap at 15s
      const maxSamples = 10 * sr;
      const frameSize = Math.floor((FRAME_MS / 1000) * sr);
      const minFrames = Math.floor(MIN_SILENCE_MS / FRAME_MS);
      const results: string[] = [];
      let position = 0;
      let idx = 0;

      while (position < data.length && !isCancelledRef.current) {
        const slice = data.subarray(position);
        // find the first silence-run at or beyond 15s
        const relativeSilence = findNextSilence(
          slice,
          sr,
          FRAME_MS,
          thresh,
          MIN_SILENCE_MS,
          maxSamples
        );

        // decide end of this chunk
        const end =
          relativeSilence !== null
            ? position + relativeSilence + frameSize * minFrames
            : Math.min(data.length, position + maxSamples);
        if (end <= position) break;

        const label = `chunk_${idx++}`;

        // extract slice → clean → encode → transcribe
        const ctx2 = getAudioCtx(); // 🔥 make sure context is alive
        if (ctx2.state === "suspended") {
          await ctx2.resume();
        }
        const buf = ctx2.createBuffer(1, end - position, sr);
        buf.copyToChannel(data.slice(position, end), 0);
        const cleaned = await cleanAudioBuffer(buf);

        if (cleaned) {
          const wav = encodeWav(cleaned);
          // const debugUrl = URL.createObjectURL(wav)
          // console.log("🔊 Transcribing chunk:", debugUrl)
          // Wait for token if not available
          const authToken = token || await waitForAuthToken();
          if (!authToken) {
            throw new Error("Authentication token not available for transcription");
          }
          const textChunk = await transcribeWithFallback(
            wav,
            label,
            0,
            authToken,
            ctx2
          );
          results.push(textChunk);
          setText(
            results.join(" ") + (end < data.length ? " ⏳ Transcribing..." : "")
          );
        }
        setProgress((end / data.length) * 100);

        position = end;
      }
      const transcript = results.join(" ");
      if (transcript.replace(/\s+/g, "").length === 0) {
        setText(
          "❌  GPT Transcriber did not detect any speech in the uploaded audio.  ❌"
        );
      } else {
        setText(transcript);
      }
    }

    // Helper function to filter a chunk on-demand
    const filterChunkOnDemand = useCallback((chunk: Chunk, chunkIndex: number): string => {
        try {
            const result = filterTextForTTS(chunk.text);
            return result.filteredText;
        } catch (error) {
            console.error(`[use-audio-url] Error filtering chunk ${chunkIndex}:`, error);
            // Fallback: use chunk as-is without filtering
            return chunk.text;
        }
    }, []);

    const injectPrompt = useCallback(async (chunkIndex: number, ndx: number = 0) => {
        if (localStorage.getItem("gptr/active") !== "true") {
            return;
        }
        const flowId = ++latestPromptFlowIdRef.current;
        
        // Get the original chunk
        const originalChunk = originalChunksRef.current[chunkIndex];
        if (!originalChunk) {
            console.error(`[injectPrompt] Chunk ${chunkIndex} not found`);
            return;
        }
        
        // Filter the chunk on-demand
        const filteredText = filterChunkOnDemand(originalChunk, chunkIndex);
        const id = originalChunk.id;
        
        const stopButton = document.querySelector("[data-testid='stop-button']") as HTMLDivElement | null;
        if (stopButton) {
            cancelActiveSendArtifacts();
            stopButton.click();
            console.log('[injectPrompt] stopButton found in injectPrompt, opening new chat...');
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
        }
        if (flowId !== latestPromptFlowIdRef.current) return;
        await waitForEditor();
        if (flowId !== latestPromptFlowIdRef.current) return;
        if (LOCAL_LOGS) console.log("[injectPrompt] Injecting chunk number:", id, "chunkIndex:", chunkIndex);
        // Cycle through helper prompts
        if (ndx >= HELPER_PROMPTS.length) {
            ndx = ndx % HELPER_PROMPTS.length;
        }
        const hp = HELPER_PROMPTS[ndx];
        // Build the raw text that will go into the editor
        const raw = `[${id}] ${hp}${filteredText}`;

        // the textContent that ends up in the editor
        const wrapper = document.createElement("div");
        wrapper.innerHTML = `<p>${filteredText}</p>`;
        const chunkTextForComparison = normalizeAlphaNumeric(wrapper.innerText || "");

        // Dispatch chunk info for audio sync
        window.dispatchEvent(new CustomEvent("SET_CHUNK_INFO", {
            detail: { chunkText: chunkTextForComparison }
        }));

        // Find the ChatGPT input element
        let editor = document.querySelector(PROMPT_INPUT_ID) as HTMLElement;
        if (!editor) {
            editor = document.querySelector("textarea.text-token-text-primary") as HTMLElement;
        }

        if (editor) {
            // Build the raw text and HTML blocks
            // instead of going to the next line i'd like to add a dot on the same line but after 10 spaces each and i want that repeated 300 times
            // const isFirefox = detectBrowser() === "firefox";
            // let raw = '';
            // let garbage = '';
            
            // if (reducedText.length > 1000000) {
            //     if (isFirefox) {
            //         garbage = "\n.\n."
            //     } else {
            //         garbage = "\n.\n.".repeat(100);
            //     }
            // }
            
            // // Chrome/WebKit: fire a synthetic paste
            // const dt = new DataTransfer();
            // dt.setData("text/plain", raw);
            // const pasteEvt = new ClipboardEvent("paste", {
            //     clipboardData: dt,
            //     bubbles: true,
            //     cancelable: true,
            // });
            // editor.dispatchEvent(pasteEvt);
            editor.innerHTML = `<p>${raw}</p>`;
            
            // Dispatch an input event so ChatGPT picks up the change
            editor.dispatchEvent(new InputEvent("input", { bubbles: true }));

            // Mark first audio load
            localStorage.setItem("gptr/is-first-audio-loading", String(id === "0"));
            // Send the prompt from the input content
            setTimeout(() => {
                sendPrompt({ text: filteredText, id, ndx, flowId, chunkIndex });
            }, 50);
            if (LOCAL_LOGS) console.log("[injectPrompt] Send button scheduled for chunk number:", id);
        } else {
            const errorMessage = `ChatGPT is showing a popup underneath this extension that is causing it to not work. Please close it and try again.`;
            console.error('In injectPrompt else:', errorMessage);
            window.dispatchEvent(new CustomEvent(LISTENERS.ERROR, { detail: { message: errorMessage } }));
            toast({
                description: errorMessage,
                style: TOAST_STYLE_CONFIG
            })
        }
    }, []);

    const startSendWatchdog = useCallback(
        (payload: { text: string; id: string; ndx: number; flowId: number; chunkIndex: number }) => {
            if (payload.flowId !== latestPromptFlowIdRef.current) return;
            // prevent parallel watchdogs
            if (sendWatchdogIntervalRef.current) {
                clearInterval(sendWatchdogIntervalRef.current);
                sendWatchdogIntervalRef.current = null;
            }

            const start = Date.now();

            // define a stop function so we can cancel elsewhere if needed
            sendWatchdogStopRef.current = () => {
            if (sendWatchdogIntervalRef.current) {
                clearInterval(sendWatchdogIntervalRef.current);
                sendWatchdogIntervalRef.current = null;
            }
            };

            // poll every 250ms for up to 5s
            sendWatchdogIntervalRef.current = window.setInterval(async () => {
                try {
                    if (payload.flowId !== latestPromptFlowIdRef.current) {
                        sendWatchdogStopRef.current();
                        return;
                    }
                    const flag = localStorage.getItem("gptr/sended");

                    // If flag is gone, the send succeeded and someone cleared it → stop.
                    // Note: retryCountRef is not reset on success - it persists to track error history
                    if (!flag) {
                        sendWatchdogStopRef.current();
                        return;
                    }

                    // If threshold elapsed and flag still present → clear + retry inject once.
                    const elapsed = Date.now() - start;
                    const thresholdMs = 20_000 + retryCountRef.current * 1_500;
                    if (elapsed >= thresholdMs) {
                        console.warn("[startSendWatchdog] Flag still present after", thresholdMs,"ms retrying...");
                        localStorage.removeItem("gptr/sended");
                        sendWatchdogStopRef.current();
                        const stopButton: HTMLButtonElement | null = document.querySelector("[data-testid='stop-button']");
                        if (stopButton) {
                            stopButton.click();
                        }
                        if (thresholdMs >= 30_000) {
                            toast({
                                description:
                                    "GPT Reader seems to be having issues. Please try again. If you see this message again, email me at democraticdeveloper@gmail.com and mention a `Watchdog Timeout` error.",
                                style: TOAST_STYLE_CONFIG,
                                duration: 30000,
                            });
                            return;
                        } else {
                            // increment retry count for next attempt
                            retryCountRef.current += 1.5;
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
                            // Find chunk index from id (id is string representation of chunk index)
                            const chunkIndex = parseInt(payload.id, 10);
                            if (!isNaN(chunkIndex) && chunkIndex >= 0 && chunkIndex < originalChunksRef.current.length) {
                                injectPrompt(chunkIndex, payload.ndx);
                            } else {
                                console.error("[startSendWatchdog] Could not find chunk index for id:", payload.id);
                            }
                        }
                    }
                } catch {
                    // On storage error, stop to avoid looping.
                    sendWatchdogStopRef.current();
                }
            }, 250);
        },
    [injectPrompt]
    );

    const splitAndSendPrompt = async (text: string, fullTextLength?: number, startOffset: number = 0) => {
        setText(text);
        const textWithoutTags = text.replace(/<img[^>]*src\s*=\s*["']\s*data:image\/[a-zA-Z]+;base64,[^"']*["'][^>]*>/gi, ''); //removes image tag if it exist in the prompt
        
        // Store original text for preview
        originalTextRef.current = textWithoutTags;
        // Track session base offset for position calculation
        sessionBaseOffsetRef.current = startOffset;
        // Track full original text length if provided (for accurate position calculation)
        if (fullTextLength !== undefined) {
            fullOriginalTextLengthRef.current = fullTextLength;
        }
        
        // Reset tracking
        chunkStartPositionsRef.current = [0]; // First chunk starts at position 0
        
        // Split original (unfiltered) text into chunks - we'll filter on-demand in injectPrompt
        const originalChunks: Chunk[] = await splitIntoChunksV2(textWithoutTags, CHUNK_SIZE);
        originalChunksRef.current = originalChunks;
        
        // Calculate start positions for each chunk
        let cumulativePos = 0;
        for (let i = 0; i < originalChunks.length; i++) {
            chunkStartPositionsRef.current[i] = cumulativePos;
            cumulativePos += originalChunks[i].text.length;
        }
        
        if (originalChunks.length > 0) {
            setCurrentChunkBeingPromptedIndex(currentChunkBeingPromptedIndex);
            // Store original chunks - we'll filter on-demand when injecting
            setChunks(originalChunks);
            chunkRef.current = originalChunks;
            
            // Inject the first chunk (will be filtered inside injectPrompt)
            injectPrompt(0, 0);
            nextChunkRef.current += 1;
            chunkNumList.current.add(0);
        }
        return
    };

    const { blobs, isFetching, completedStreams, currentCompletedStream, reset: resetStreamListener, setVoices, voices, isVoiceLoading, promptNdx } = useStreamListener(setIsLoading, nextChunkRef, chunkRef, injectPrompt, isDownload, isPromptingPausedRef, lastInjectedChunkNdxRef); 
    const currentStreamChunkNdxRef = useRef(currentCompletedStream?.chunkNdx);

  
    useMemo(() => {
        if (blobs.length === 0) {
          setProgress(0);
          setDownloadPreviewText(undefined);
          return;
        }
        
        // Calculate total filtered chars
        // For totalChars: use original chunk lengths (estimate, since we don't know filtered lengths of unprocessed chunks yet)
        // This ensures progress denominator is based on all chunks, not just processed ones
        const totalChars = originalChunksRef.current.reduce((sum, chunk) => sum + chunk.text.length, 0);

        // build a set of available indices
        const have = new Set<number>();
        for (const b of blobs) have.add(b.chunkNumber);

        // longest sequential prefix 0..k (no gaps)
        let k = -1;
        while (have.has(k + 1)) k += 1;

        // Calculate chars processed based on original chunk lengths (consistent with totalChars)
        const charsSoFar = k >= 0
            ? originalChunksRef.current.slice(0, k + 1).reduce((sum, chunk) => sum + chunk.text.length, 0)
            : 0;
        

        if (LOCAL_LOGS) {
            // 🔎 log missing chunk numbers
            const missing: number[] = [];
            for (let i = 0; i < originalChunksRef.current.length; i++) {
                if (!have.has(i)) {
                    missing.push(i);
                }
            }
            console.log("[UseAudioUrl] Missing chunkNumbers:", missing);
        }

        setProgress(totalChars > 0 ? (charsSoFar / totalChars) * 100 : 0);

        // Build download preview ONLY from the sequential prefix (0..k)
        // Simply join the text from chunks 0 to k - these are the completed chunks
        if (k >= 0 && originalChunksRef.current.length > 0) {
            // Join text from chunks 0 to k
            const preview = originalChunksRef.current
                .slice(0, k + 1)
                .map(chunk => chunk.text)
                .join('')
                .replaceAll("\n", " ");
            setDownloadPreviewText(preview);
            
            // mirror as rich HTML (when we have a DOCX HTML source)
            if (htmlSlicerRef.current) {
                const next = htmlSlicerRef.current(preview);
                setDownloadPreviewHtml(prev =>
                    next && next.length >= (prev?.length ?? 0) ? next : (prev ?? "")
                );
            }

            // Calculate and store download position for "continue from last session"
            // We need chunkStartPositionsRef to calculate the absolute offset in the full original text
            if (isDownload && onSaveDownloadPosition && chunkStartPositionsRef.current.length > 0) {
                // Calculate the position: start of chunk k+1 (where we should resume from)
                // If we've completed chunks 0..k, we should resume from the start of chunk k+1
                let lastOriginalIndex: number;
                if (k + 1 < chunkStartPositionsRef.current.length) {
                    // Position is at the start of the next unprocessed chunk (k+1)
                    lastOriginalIndex = chunkStartPositionsRef.current[k + 1];
                } else {
                    // We've completed all chunks, position is at the end of text (no more to process)
                    lastOriginalIndex = originalChunksRef.current.reduce((sum, chunk) => sum + chunk.text.length, 0);
                }
                
                const absoluteOffset = sessionBaseOffsetRef.current + lastOriginalIndex;
                
                // Calculate endText: last ~100 characters of the last completed chunk (chunk k)
                // This helps us find the exact resume point when re-chunking
                let endText: string | undefined;
                if (k >= 0 && k < originalChunksRef.current.length) {
                    const lastCompletedChunk = originalChunksRef.current[k];
                    if (lastCompletedChunk && lastCompletedChunk.text) {
                        // Take last 100 characters (or less if chunk is shorter)
                        const endLength = Math.min(100, lastCompletedChunk.text.length);
                        endText = lastCompletedChunk.text.slice(-endLength);
                    }
                }
                
                calculatedDownloadPositionRef.current = absoluteOffset;
                
                // Store endText along with position (will be saved in useEffect)
                lastSavedEndTextRef.current = endText;
            }
        } else {
            setDownloadPreviewText(undefined);
            setDownloadPreviewHtml("");
        }

        // —— Premium modal trigger moved here ——
        if (
            !isSubscribed &&
            isDownload &&
            k >= FREE_DOWNLOAD_CHUNKS &&
            originalChunksRef.current.length - 1 !== FREE_DOWNLOAD_CHUNKS
        ) {
            const firstTimeFreeDownloadHappened = localStorage.getItem("gptr/firstTimeFreeDownloadHappened");
            if (firstTimeFreeDownloadHappened) {
                setTimeout(() => {
                    handleError(
                        "Free users can only download around 5 minutes of audio at a time. Consider upgrading to download without limits. You can click on the download button below to download what has been processed so far."
                    );
                    setReason(
                        "Free users can only download around 5 minutes of audio at a time. You will need to upgrade to download without limits, but you can still download what has been processed so far!"
                    );
                    setOpen(true);
                }, 3000);
            } else {
                if (!localStorage.getItem("gptr/firstTimeFreeDownloadInProgress")) {
                    // Show the popup for "First time's on us"
                    setShowFirstTimeFreeDownloadPopup(true);
                    localStorage.setItem("gptr/firstTimeFreeDownloadInProgress", "true");
                    // Also set in chrome.storage.local
                    void chrome.storage.local.set({ "gptr/firstTimeFreeDownloadInProgress": "true" }).catch(() => {
                        // Ignore errors
                    });
                }
            }
        }
        if (blobs.length === originalChunksRef.current.length && blobs.length > 0) {
            if (!isDownload && !showCompletionToast.current) {
                showCompletionToast.current = true;
                toast({ description: `GPT Reader has finished processing your audio, click on the cloud button above to download it!`, style: TOAST_STYLE_CONFIG_INFO });
            }
            localStorage.removeItem("gptr/equalIssue");
            (async () => {
                // Also try to delete any leftover chats we scheduled in LS (except current if active)
                await collectChatsAboveTopChat();
                try {
                    const list = JSON.parse(localStorage.getItem("gptr/chatsToDelete") || "[]") as string[];
                    if (Array.isArray(list) && list.length) {
                        for (const id of list) {
                            await maybeDeleteChat(id);
                        }
                    }
                } catch {
                // ignore
                }
            })();
        }
    }, [chunks, blobs, isDownload]);

    // Save download position separately to avoid infinite loops
    // This runs after the useMemo calculates the position
    useEffect(() => {
        if (!isDownload || !onSaveDownloadPositionRef.current) return;
        
        const currentPosition = calculatedDownloadPositionRef.current;
        const currentEndText = lastSavedEndTextRef.current;
        
        // Only save if position has actually changed and is valid
        if (currentPosition >= 0 && currentPosition !== lastSavedDownloadPositionRef.current) {
            lastSavedDownloadPositionRef.current = currentPosition;
            try {
                onSaveDownloadPositionRef.current(currentPosition, currentEndText);
            } catch (error) {
                console.error("[use-audio-url] Error saving download position:", error);
            }
        }
    }, [chunks, blobs, isDownload]);
    
    // Also save position periodically during download (every 2 seconds) to ensure we don't lose progress
    useEffect(() => {
        if (!isDownload || !onSaveDownloadPositionRef.current) return;
        
        const interval = setInterval(() => {
            if (!onSaveDownloadPositionRef.current) return;
            const currentPosition = calculatedDownloadPositionRef.current;
            const currentEndText = lastSavedEndTextRef.current;
            if (currentPosition >= 0 && currentPosition !== lastSavedDownloadPositionRef.current) {
                lastSavedDownloadPositionRef.current = currentPosition;
                try {
                    onSaveDownloadPositionRef.current(currentPosition, currentEndText);
                } catch (error) {
                    console.error("[use-audio-url] Error in periodic position save:", error);
                }
            }
        }, 2000); // Save every 2 seconds during download
        
        return () => clearInterval(interval);
    }, [isDownload]);
    
    const extractText = async (file: File) => {
        switch (file.type) {
            case "application/pdf": {
                return await pdfToText(file);
            }
            case "application/msword":
            case "application/vnd.openxmlformats-officedocument.wordprocessingml.document": {
                return await docxToText(file);
            }
            case "text/plain":
            case "text/rtf": {
                return await textPlainToText(file);
            }
            default:
                toast({ description: chrome.i18n.getMessage('unsupported_file_type'), style: TOAST_STYLE_CONFIG });
                break;
        }
    }

    const cancelTranscription = () => {
      isCancelledRef.current = true;
    };

    const reset = () => {
        latestPromptFlowIdRef.current += 1;
        retryCountRef.current = 0;
        cancelActiveSendArtifacts();
        sendWaitCancelRef.current = null;
        showCompletionToast.current = false;
        setAudioUrls([]);
        setCurrentChunkBeingPromptedIndex(0);
        setChunks([]);
        stopPrompt()
        setText("");
        setIsLoading(false);
        resetStreamListener();
        setProgress(0);
        setIsPromptingPaused(false);
        nextChunkRef.current = 0;
        chunkNumList.current.clear();
        currentStreamChunkNdxRef.current = 0;
        chunkRef.current = [];
        if (sendWatchdogIntervalRef.current) {
            clearInterval(sendWatchdogIntervalRef.current);
            sendWatchdogIntervalRef.current = null;
        }
        sendWatchdogStopRef.current = () => {};
        if (activeSendObserver) {
            activeSendObserver.disconnect();
            activeSendObserver = null;
        }
        if(isDownload){
            setDownloadPreviewText(undefined);
        }
        // clear progressive HTML slicer/preview
        htmlSlicerRef.current = null;
        setDownloadPreviewHtml("");
        originalTextRef.current = "";
        originalChunksRef.current = [];
        chunkStartPositionsRef.current = [];
        sessionBaseOffsetRef.current = 0;
        fullOriginalTextLengthRef.current = 0;
        lastSavedDownloadPositionRef.current = -1;
        calculatedDownloadPositionRef.current = -1;
        lastSavedEndTextRef.current = undefined;
        if (audioCtxRef.current && audioCtxRef.current.state !== "closed") {
          audioCtxRef.current.close();
          audioCtxRef.current = null; // allow reinit later
        }
        setShowFirstTimeFreeDownloadPopup(false);
    }

    const reStartChunkProcess = (click: boolean = false) => {
        if (!click && nextChunkRef.current && nextChunkRef.current > 0 && nextChunkRef.current < originalChunksRef.current.length && (nextChunkRef.current) % CHUNK_TO_PAUSE_ON === 0) {
            return;
        }
        if (LOCAL_LOGS) console.log("Attempting to reStartChunkProcess");
        if (currentStreamChunkNdxRef.current != (nextChunkRef.current - 1)) {
            if (chunkNumList.current.has(nextChunkRef.current-1)) return;
            const chunkIndex = nextChunkRef.current-1;
            if (originalChunksRef.current[chunkIndex]) {
                if (LOCAL_LOGS) console.log("[ReStartChunkProcess] incorrect order detected");
                chunkNumList.current.add(chunkIndex);
                setIsPromptingPaused(false);
                setCurrentChunkBeingPromptedIndex(chunkIndex);
                // injectPrompt will filter on-demand
                injectPrompt(chunkIndex, promptNdx.current);
            }
            return;
        }
        const chunkIndex = nextChunkRef.current;
        if (originalChunksRef.current[chunkIndex] && !chunkNumList.current.has(chunkIndex)) {
            if (LOCAL_LOGS) console.log("[ReStartChunkProcess] injecting chunk", chunkIndex);
            chunkNumList.current.add(chunkIndex);
            setIsPromptingPaused(false);
            setCurrentChunkBeingPromptedIndex(chunkIndex);
            // injectPrompt will filter on-demand
            injectPrompt(chunkIndex, promptNdx.current);
            nextChunkRef.current += 1;
        }
    };

    const downloadCombinedFile = useCallback(async(fileName: string) => {
        try {
            const sanitisedFileName = fileName.split('.').slice(0, -1).join('.');
            // dedupe & sort by chunkNumber
            const seen = new Set<number>();
            const sorted = blobs
            .slice()
            .sort((a, b) => a.chunkNumber - b.chunkNumber)
            .filter(entry => {
                if (seen.has(entry.chunkNumber)) return false;
                seen.add(entry.chunkNumber);
                return true;
            });

            // ONLY the longest sequential prefix: 0..k with no gaps
            const prefixBlobs: Blob[] = [];
            let expected = 0;
            for (const entry of sorted) {
                if (entry.chunkNumber === expected) {
                    prefixBlobs.push(entry.blob);
                    expected += 1;
                } else {
                    break;
                }
            }
            if (prefixBlobs.length === 0) {
                console.warn("No sequential audio available to download yet.");
                return;
            }

            const combinedBlob = new Blob(prefixBlobs, {
                type: prefixBlobs[0]?.type || mimeCodec,
            });

            const combinedUrl = URL.createObjectURL(combinedBlob);
            const downloadLink = document.createElement("a");
            downloadLink.href = combinedUrl;
            downloadLink.download = `${sanitisedFileName}.${storedFormat}`;
            document.body.appendChild(downloadLink);
            downloadLink.click();
            document.body.removeChild(downloadLink);
            URL.revokeObjectURL(combinedUrl);
        } catch (error) {
            console.error("Error downloading combined file:", error);
        }
    }, [blobs, format]);


      
    useEffect(() => {
        if (LOCAL_LOGS) console.log("[currentCompletedStream useEffect] Recived chunk number:", currentCompletedStream?.chunkNdx);
        currentStreamChunkNdxRef.current = currentCompletedStream?.chunkNdx;

        if (currentCompletedStream?.chunkNdx != (nextChunkRef.current - 1)) {
            const chunkIndex = nextChunkRef.current - 1;
            if (chunkNumList.current.has(chunkIndex)) {
                if (LOCAL_LOGS) console.log("[useAudioUrl] chunkNumList already has chunk", chunkIndex);
                return;
            }
            if (originalChunksRef.current[chunkIndex]) {
                chunkNumList.current.add(chunkIndex);
                setCurrentChunkBeingPromptedIndex(chunkIndex);
                // injectPrompt will filter on-demand
                injectPrompt(chunkIndex, promptNdx.current);
            }
            return;
        } else {
            if (LOCAL_LOGS) console.log("[useAudioUrl] Chunk is in the correct order");
        }

        if (!isSubscribed && isDownload && currentStreamChunkNdxRef.current === FREE_DOWNLOAD_CHUNKS && currentStreamChunkNdxRef.current !== originalChunksRef.current.length - 1) {
            const firstTimeFreeDownloadHappened = localStorage.getItem("gptr/firstTimeFreeDownloadHappened");
            if (firstTimeFreeDownloadHappened) {
                return;
            }  
        } else {
            if (LOCAL_LOGS) console.log("[useAudioUrl] User is not a free download user");
        }
        
        // This is not the best way to set audioUrls due to the speed improvement, but we don't care for now
        if (!isDownload) {
            setAudioUrls(completedStreams);
        }

        if (isPromptingPaused) {
            if (LOCAL_LOGS) console.log("[useAudioUrl] isPromptingPaused is true");
            return;
        }
       
        if (
            currentCompletedStream?.chunkNdx != null &&
            +currentCompletedStream.chunkNdx !== originalChunksRef.current.length - 1
        ) {
            if (LOCAL_LOGS) console.log("[useAudioUrl] Attempting to prompt next chunk");
            const chunkIndex = +currentCompletedStream.chunkNdx + 1;
            if (!isDownload && chunkIndex > 0 && chunkIndex < originalChunksRef.current.length - 1 && ((chunkIndex % CHUNK_TO_PAUSE_ON) === 0)) {
                setIsPromptingPaused(true);
                setWasPromptStopped("PAUSED");
                return;
            }
            if (originalChunksRef.current[chunkIndex] && !chunkNumList.current.has(chunkIndex)) {
                chunkNumList.current.add(chunkIndex);
                setCurrentChunkBeingPromptedIndex(chunkIndex);
                // injectPrompt will filter on-demand
                injectPrompt(chunkIndex, promptNdx.current);
                nextChunkRef.current += 1;
            } else {
                if (LOCAL_LOGS) console.log("[useAudioUrl] No next chunk to prompt");
            }
        } else {
            if (LOCAL_LOGS) console.log("[useAudioUrl] No next chunk to prompt:", currentCompletedStream?.chunkNdx, originalChunksRef.current.length - 1);
        }
    }, [currentCompletedStream, isPromptingPaused])

    return {
        downloadPreviewText,
        downloadPreviewHtml,
        setPreviewHtmlSource,
        downloadCombinedFile,
        progress,
        setProgress,
        blobs,
        isFetching,
        wasPromptStopped,
        setWasPromptStopped,
        chunks,
        voices,
        setVoices,
        isVoiceLoading,
        text,
        audioUrls,
        setAudioUrls,
        extractText,
        splitAndSendPrompt,
        ended: currentCompletedStream?.chunkNdx != null && +currentCompletedStream?.chunkNdx === originalChunksRef.current.length - 1,
        isLoading,
        setIsLoading,
        reset,
        is9ThChunk,
        reStartChunkProcess,
        setIs9thChunk,
        isPromptingPaused,
        setIsPromptingPaused,
        transcribeChunks,
        cancelTranscription,
        setText,
        showFirstTimeFreeDownloadPopup,
        setShowFirstTimeFreeDownloadPopup
    }
}

export default useAudioUrl;
