/* eslint-disable @typescript-eslint/no-explicit-any */
import { CHUNK_SIZE, CHUNK_TO_PAUSE_ON, FRAME_MS, HELPER_PROMPTS, LISTENERS, MIN_SILENCE_MS, LOCAL_LOGS, PROMPT_INPUT_ID, TOAST_STYLE_CONFIG, TOAST_STYLE_CONFIG_INFO, FREE_DOWNLOAD_CHUNKS } from "@/lib/constants";
import { Chunk, cleanAudioBuffer, computeNoiseFloor, encodeWav, findNextSilence, handleError, normalizeAlphaNumeric, splitIntoChunksV2, transcribeWithFallback, waitForEditor } from "@/lib/utils";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import useFileReader, { makeHtmlProgressSlicer } from "./use-file-reader";
import useStreamListener from "./use-stream-listener";
import { useToast } from "./use-toast";
import useFormat from "./use-format";
import { usePremiumModal } from "@/context/premium-modal";
import useAuthToken from "./use-auth-token";

const useAudioUrl = (isDownload: boolean) => {
    const isCancelledRef = useRef<boolean>(false);
    const audioCtxRef = useRef<AudioContext | null>(null);

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
    const [wasPromptStopped, setWasPromptStopped] = useState<"LOADING" | "PAUSED" | "INIT">("INIT");
    const { pdfToText, docxToText, textPlainToText } = useFileReader();
    const [progress, setProgress] = useState<number>(0);
    const [downloadPreviewText, setDownloadPreviewText] = useState<string>();
    // NEW: progressive rich HTML (mirrors downloadPreviewText length)
    const [downloadPreviewHtml, setDownloadPreviewHtml] = useState<string>("");
    const htmlSlicerRef = useRef<null | ((ref: string) => string)>(null);
    const sendWatchdogIntervalRef = useRef<number | null>(null);
    const sendWatchdogStopRef = useRef<() => void>(() => {});


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
    
    const sendPrompt = (payload: { text: string; id: string; ndx: number }) => {
        setIsLoading(true);
        const clickAndWatch = (btn: HTMLButtonElement) => {
            btn.click();
            // only set the flag if we actually clicked
            try {
            localStorage.setItem("gptr/sended", "true");
            } catch { /* ignore */ }
            // start the non-blocking watchdog
            startSendWatchdog(payload);
        };
        
        const sendButton = document.querySelector("[data-testid='send-button']") as HTMLButtonElement | null;
        if (sendButton && !sendButton.disabled) {
            clickAndWatch(sendButton);
            return;
        }
    
        // Prevent multiple observers
        if (activeSendObserver) {
            activeSendObserver.disconnect();
            activeSendObserver = null;
        }

        const observer = new MutationObserver((mutations, obs) => {
            const btn = document.querySelector("[data-testid='send-button']") as HTMLButtonElement | null;
            if (btn && !btn.disabled) {
                clickAndWatch(btn);
                obs.disconnect();
                activeSendObserver = null;
                clearTimeout(timeout);
            }
        });
    
        observer.observe(document.body, { childList: true, subtree: true });
        activeSendObserver = observer;
    
        const timeout = setTimeout(() => {
            observer.disconnect();
            activeSendObserver = null;
            console.error("[sendPrompt] Send button not found after 20 seconds.");
            toast({
                description: `GPT Reader is having trouble, please refresh your page and try again. You may have reached ChatGPT's hourly limit and will need to wait for a few minutes.`,
                style: TOAST_STYLE_CONFIG,
                duration: 30000
            })
        }, 20000);
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
          const textChunk = await transcribeWithFallback(
            wav,
            label,
            0,
            token!,
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

    const injectPrompt = useCallback(async (text: string, id: string, ndx: number = 0) => {
        const stopButton = document.querySelector("[data-testid='stop-button']") as HTMLDivElement | null;
        if (stopButton) {
            stopButton.click();
            console.log('[injectPrompt] stopButton found in injectPrompt, opening new chat...');
            await new Promise<void>(async (resolve) => {
                const newChatBtn = document.querySelector<HTMLButtonElement>(
                    "[data-testid='create-new-chat-button'], [aria-label='New chat']"
                );
                if (newChatBtn) {
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
        await waitForEditor();
        if (LOCAL_LOGS) console.log("[injectPrompt] Injecting chunk number:", id);
        // Cycle through helper prompts
        if (ndx >= HELPER_PROMPTS.length) {
            ndx = ndx % HELPER_PROMPTS.length;
        }
        const hp = HELPER_PROMPTS[ndx];
        // Build the raw text that will go into the editor
        const raw = `[${id}] ${hp}${text}`;

        // the textContent that ends up in the editor
        const wrapper = document.createElement("div");
        wrapper.innerHTML = `<p>${text}</p>`;
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
                sendPrompt({ text, id, ndx });
            }, 50);
            if (LOCAL_LOGS) console.log("[injectPrompt] Send button clicked for chunk number:", id);
        } else {
            // Fallback error
            const errorMessage = `GPT Reader is having trouble, please refresh your page and try again`;
            console.error('In injectPrompt else:', errorMessage);
            window.dispatchEvent(new CustomEvent(LISTENERS.ERROR, { detail: { message: errorMessage } }));
            toast({
                description: errorMessage,
                style: TOAST_STYLE_CONFIG
            })
        }
    }, []);

    const startSendWatchdog = useCallback(
        (payload: { text: string; id: string; ndx: number }) => {
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
                    const flag = localStorage.getItem("gptr/sended");

                    // If flag is gone, the send succeeded and someone cleared it → stop.
                    if (!flag) {
                        sendWatchdogStopRef.current();
                        return;
                    }

                    // If 5s elapsed and flag still present → clear + retry inject once.
                    const elapsed = Date.now() - start;
                    if (elapsed >= 5000) {
                        console.log("[startSendWatchdog] Flag still present after 5s, retrying...");
                        localStorage.removeItem("gptr/sended");
                        sendWatchdogStopRef.current();
                        const stopButton: HTMLButtonElement | null = document.querySelector("[data-testid='stop-button']");
                        if (stopButton) {
                            stopButton.click();
                        }
                        await new Promise<void>(async (resolve) => {
                            const newChatBtn = document.querySelector<HTMLButtonElement>(
                                "[data-testid='create-new-chat-button'], [aria-label='New chat']"
                            );
                            if (newChatBtn) {
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
                        injectPrompt(payload.text, payload.id, payload.ndx);
                    }
                } catch {
                    // On storage error, stop to avoid looping.
                    sendWatchdogStopRef.current();
                }
            }, 250);
        },
    [injectPrompt]
    );

    const splitAndSendPrompt = async (text: string) => {
        setText(text);
        const textWithoutTags = text.replace(/<img[^>]*src\s*=\s*["']\s*data:image\/[a-zA-Z]+;base64,[^"']*["'][^>]*>/gi, ''); //removes image tag if it exist in the prompt
        const chunks: Chunk[] = await splitIntoChunksV2(textWithoutTags, CHUNK_SIZE);
        if (chunks.length > 0) {
            setCurrentChunkBeingPromptedIndex(currentChunkBeingPromptedIndex);
            setChunks(chunks);
            chunkRef.current = chunks;
            injectPrompt(chunks[0].text, chunks[0].id, 0);
            // monitorStopButton();
            nextChunkRef.current += 1;
            chunkNumList.current.add(0);
        }
        return
    };

    const { blobs, isFetching, completedStreams, currentCompletedStream, reset: resetStreamListener, setVoices, voices, isVoiceLoading, promptNdx } = useStreamListener(setIsLoading, nextChunkRef, chunkRef, injectPrompt, isDownload); 
    const currentStreamChunkNdxRef = useRef(currentCompletedStream?.chunkNdx);

  
    useMemo(() => {
        if (blobs.length === 0) {
          setProgress(0);
          setDownloadPreviewText(undefined);
          return;
        }
        
        const totalChars = chunks.reduce((sum, chunk) => sum + chunk.text.length, 0);

        // build a set of available indices
        const have = new Set<number>();
        for (const b of blobs) have.add(b.chunkNumber);

        // longest sequential prefix 0..k (no gaps)
        let k = -1;
        while (have.has(k + 1)) k += 1;

        const charsSoFar = k >= 0
        ? chunks.slice(0, k + 1).reduce((sum, chunk) => sum + chunk.text.length, 0)
        : 0;

        if (LOCAL_LOGS) {
            // 🔎 log missing chunk numbers
            const missing: number[] = [];
            for (let i = 0; i < chunks.length; i++) {
                if (!have.has(i)) {
                    missing.push(i);
                }
            }
            console.log("[UseAudioUrl] Missing chunkNumbers:", missing);
        }

        setProgress(totalChars > 0 ? (charsSoFar / totalChars) * 100 : 0);

        // Build download preview ONLY from the sequential prefix (0..k)
        if (k >= 0) {
            const preview = chunks
                .slice(0, k + 1)
                .map(c => (c.text ?? "").replaceAll("\n", " "))
                .join("");
            setDownloadPreviewText(preview);
            // mirror as rich HTML (when we have a DOCX HTML source)
            if (htmlSlicerRef.current) {
                const next = htmlSlicerRef.current(preview);
                setDownloadPreviewHtml(prev =>
                    next && next.length >= (prev?.length ?? 0) ? next : (prev ?? "")
                );
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
            chunks.length - 1 !== FREE_DOWNLOAD_CHUNKS
        ) {
            setTimeout(() => {
                handleError(
                    "Free users can only download around 2500 characters at a time. Consider upgrading to download without limits. You can click on the download button below to download what has been processed so far."
                );
                setReason(
                    "Free users can only download around 2500 characters at a time. Please upgrade to download without limits!"
                );
                setOpen(true);
            }, 3000);
        }
        if (blobs.length === chunks.length && !isDownload && blobs.length > 0 && !showCompletionToast.current) {
            showCompletionToast.current = true;
            toast({ description: `GPT Reader has finished processing your audio, click on the cloud button above to download it!`, style: TOAST_STYLE_CONFIG_INFO });
        }
    }, [chunks, blobs, isDownload]);
    
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
        if (audioCtxRef.current && audioCtxRef.current.state !== "closed") {
          audioCtxRef.current.close();
          audioCtxRef.current = null; // allow reinit later
        }
    }

    const reStartChunkProcess = (click: boolean = false) => {
        if (!click && nextChunkRef.current && nextChunkRef.current > 0 && nextChunkRef.current < chunks.length && (nextChunkRef.current) % CHUNK_TO_PAUSE_ON === 0) {
            return;
        }
        if (LOCAL_LOGS) console.log("Attempting to reStartChunkProcess");
        if (currentStreamChunkNdxRef.current != (nextChunkRef.current - 1)) {
            if (chunkNumList.current.has(nextChunkRef.current-1)) return;
            const chunk = chunks[nextChunkRef.current-1];
            if (chunk) {
                if (LOCAL_LOGS) console.log("[ReStartChunkProcess] incorrect order detected");
                chunkNumList.current.add(nextChunkRef.current-1);
                setIsPromptingPaused(false);
                setCurrentChunkBeingPromptedIndex(
                    nextChunkRef.current-1
                );
                injectPrompt(chunk.text, chunk.id, promptNdx.current);
            }
            return;
        }
        const nextChunk = chunks[nextChunkRef.current];
        if (nextChunk && !chunkNumList.current.has(nextChunkRef.current)) {
            if (LOCAL_LOGS) console.log("[ReStartChunkProcess] injecting chunk", nextChunk.id);
            chunkNumList.current.add(nextChunkRef.current);
            setIsPromptingPaused(false);
            setCurrentChunkBeingPromptedIndex(nextChunkRef.current);
            injectPrompt(nextChunk.text, nextChunk.id, promptNdx.current);
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
            if (chunkNumList.current.has(nextChunkRef.current-1)) {
                if (LOCAL_LOGS) console.log("[useAudioUrl] chunkNumList already has chunk", nextChunkRef.current-1);
                return;
            }
            const chunk = chunks[nextChunkRef.current-1];
            if (chunk) {
                chunkNumList.current.add(nextChunkRef.current-1);
                setCurrentChunkBeingPromptedIndex(
                    nextChunkRef.current-1
                );
                injectPrompt(chunk.text, chunk.id, promptNdx.current);
            }
            return;
        } else {
            if (LOCAL_LOGS) console.log("[useAudioUrl] Chunk is in the correct order");
        }

        if (!isSubscribed && isDownload && currentStreamChunkNdxRef.current === FREE_DOWNLOAD_CHUNKS && currentStreamChunkNdxRef.current !== chunks.length - 1) {
            return;
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
            +currentCompletedStream.chunkNdx !== chunks.length - 1
        ) {
            if (LOCAL_LOGS) console.log("[useAudioUrl] Attempting to prompt next chunk");
            const nextChunk = chunks[+currentCompletedStream.chunkNdx + 1];
            const chunkNumber = currentCompletedStream?.chunkNdx + 1;
            if (!isDownload && chunkNumber && +chunkNumber > 0 && +chunkNumber < chunks.length - 1 && (((+chunkNumber) % CHUNK_TO_PAUSE_ON) === 0)) {
                setIsPromptingPaused(true);
                setWasPromptStopped("PAUSED");
                return;
            }
            if (nextChunk && !chunkNumList.current.has(+currentCompletedStream.chunkNdx + 1)) {
                chunkNumList.current.add(+currentCompletedStream.chunkNdx + 1);
                setCurrentChunkBeingPromptedIndex(
                    +currentCompletedStream.chunkNdx + 1
                );
                injectPrompt(nextChunk.text, nextChunk.id, promptNdx.current);
                nextChunkRef.current += 1;
            } else {
                if (LOCAL_LOGS) console.log("[useAudioUrl] No next chunk to prompt");
            }
        } else {
            if (LOCAL_LOGS) console.log("[useAudioUrl] No next chunk to prompt:", currentCompletedStream?.chunkNdx, chunks.length - 1);
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
        ended: currentCompletedStream?.chunkNdx != null && +currentCompletedStream?.chunkNdx === chunks.length - 1,
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
        setText
    }
}

export default useAudioUrl;
