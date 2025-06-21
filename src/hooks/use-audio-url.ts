import { CHUNK_SIZE, CHUNK_TO_PAUSE_ON, HELPER_PROMPTS, LISTENERS, PROMPT_INPUT_ID, TOAST_STYLE_CONFIG, TOAST_STYLE_CONFIG_INFO } from "@/lib/constants";
import { Chunk, detectBrowser, normalizeAlphaNumeric, splitIntoChunksV2 } from "@/lib/utils";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import useFileReader from "./use-file-reader";
import useStreamListener from "./use-stream-listener";
import { useToast } from "./use-toast";

const useAudioUrl = (isDownload: boolean) => {
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
    const promptPausedRef = useRef(isPromptingPaused);
    const nextChunkRef = useRef<number>(0);
    const [chunks, setChunks] = useState<Chunk[]>([]);
    const chunkRef = useRef<Chunk[]>([]);
    const chunkNumList = useRef<Set<number>>(new Set());
    let activeSendObserver: MutationObserver | null = null;
    
    const sendPrompt = () => {
        setIsLoading(true);
    
        const sendButton = document.querySelector("[data-testid='send-button']") as HTMLButtonElement | null;
        if (sendButton && !sendButton.disabled) {
            sendButton.click();
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
                btn.click();
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
            console.error("[sendPrompt] Send button not found after 35 seconds.");
            toast({
                description: `GPT Reader is having trouble, please refresh your page and try again`,
                style: TOAST_STYLE_CONFIG
            })
        }, 35000);
    };
    
    const stopPrompt = async () => {
        const stopButton: HTMLButtonElement | null = document.querySelector("[data-testid='stop-button']");
        if (stopButton) {
            stopButton.click();
        }
    };

    const injectPrompt = useCallback(async (text: string, id: string, ndx: number = 0) => {
        // Dispatch chunk info for audio sync
        const reducedText = normalizeAlphaNumeric(text);
        window.dispatchEvent(new CustomEvent("SET_CHUNK_INFO", {
            detail: { chunkText: reducedText }
        }));

        // Cycle through helper prompts
        if (ndx >= HELPER_PROMPTS.length) {
            ndx = ndx % HELPER_PROMPTS.length;
        }
        const hp = HELPER_PROMPTS[ndx];

        // Find the ChatGPT input element
        let editor = document.querySelector(PROMPT_INPUT_ID) as HTMLElement;
        if (!editor) {
            editor = document.querySelector("textarea.text-token-text-primary") as HTMLElement;
        }

        if (editor) {
            // Build the raw text and HTML blocks
            // instead of going to the next line i'd like to add a dot on the same line but after 10 spaces each and i want that repeated 300 times
            const isFirefox = detectBrowser() === "firefox";
            let raw = '';
            let garbage = '';
            
            if (reducedText.length > 200) {
                if (isFirefox) {
                    garbage = "\n.\n."
                } else {
                    garbage = "\n.\n.".repeat(100);
                }
            }
            raw = `[${id}] ${hp}${text}${garbage}`;
            
            if (!isFirefox) {
                // Chrome/WebKit: fire a synthetic paste
                const dt = new DataTransfer();
                dt.setData("text/plain", raw);
                const pasteEvt = new ClipboardEvent("paste", {
                    clipboardData: dt,
                    bubbles: true,
                    cancelable: true,
                });
                editor.dispatchEvent(pasteEvt);
            } else {
                editor.innerHTML = `<p>${raw}</p>`;
            }
            
            // Dispatch an input event so ChatGPT picks up the change
            editor.dispatchEvent(new InputEvent("input", { bubbles: true }));

            // Mark first audio load
            localStorage.setItem("gptr/is-first-audio-loading", String(id === "0"));
            // Send the prompt from the input content
            setTimeout(() => {
                sendPrompt();
            }, 50);
        } else {
            // Fallback error
            const errorMessage = `GPT Reader is having trouble, please refresh your page and try again`;
            window.dispatchEvent(new CustomEvent(LISTENERS.ERROR, { detail: { message: errorMessage } }));
            toast({
                description: errorMessage,
                style: TOAST_STYLE_CONFIG
            })
        }
    }, []);

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

    const { blobs, isFetching, completedStreams, currentCompletedStream, reset: resetStreamListener, setVoices, voices, isVoiceLoading, promptNdx } = useStreamListener(setIsLoading, nextChunkRef, chunkRef, injectPrompt); 
    const currentStreamChunkNdxRef = useRef(currentCompletedStream?.chunkNdx);

    useEffect(() => {
        promptPausedRef.current = isPromptingPaused;
    }, [isPromptingPaused]);

  
    useMemo(() => {
        if (blobs.length === 0) {
          setProgress(0);
          setDownloadPreviewText(undefined);
          return;
        }
        if(currentCompletedStream){
            const text = chunks[+currentCompletedStream?.chunkNdx]?.text ?? "";
            setDownloadPreviewText(t => (t ?? "")  + `${text.replaceAll("\n", " ") ?? ""}`);
        }
        const totalChars = chunks.reduce((sum, chunk) => sum + chunk.text.length, 0);
        const charsSoFar = chunks
            .slice(0, blobs.length)
            .reduce((sum, chunk) => sum + chunk.text.length, 0);
        setProgress((charsSoFar / totalChars) * 100);
        if (blobs.length === chunks.length && !isDownload && blobs.length > 0) {
            toast({ description: `GPT Reader has finished processing your audio, click on the cloud button above to download it!`, style: TOAST_STYLE_CONFIG_INFO });
        }
      }, [chunks, blobs, currentCompletedStream, isDownload]);
    
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

    const reset = () => {
        setAudioUrls([]);
        setCurrentChunkBeingPromptedIndex(0);
        setChunks([]);
        stopPrompt()
        setText("");
        setIsLoading(false);
        resetStreamListener();
        setProgress(0);
        setIsPromptingPaused(false);
        promptPausedRef.current = false;
        nextChunkRef.current = 0;
        chunkNumList.current.clear();
        currentStreamChunkNdxRef.current = 0;
        chunkRef.current = [];
        if (activeSendObserver) {
            activeSendObserver.disconnect();
            activeSendObserver = null;
        }
        if(isDownload){
            setDownloadPreviewText(undefined);
        }
    }

    const reStartChunkProcess = () => {
        if (currentStreamChunkNdxRef.current != (nextChunkRef.current - 1)) {
            if (chunkNumList.current.has(nextChunkRef.current-1)) return;
            const chunk = chunks[nextChunkRef.current-1];
            if (chunk) {
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
          const seen = new Set<number>();
          const ordered = blobs
            .slice()
            .sort((a, b) => a.chunkNumber - b.chunkNumber)
            .filter(entry => {
                if (seen.has(entry.chunkNumber)) return false;
                seen.add(entry.chunkNumber);
                return true;
            })
            .map(entry => entry.blob);

          // The Blob constructor automatically concatenates the provided blob parts.
          const combinedBlob = new Blob(ordered, {
            type: ordered[0]?.type || "audio/mpeg",
          });
    
          // Create an object URL for the combined blob
          const combinedUrl = URL.createObjectURL(combinedBlob);
    
          // Create a temporary download link and trigger a click to start download
          const downloadLink = document.createElement("a");
          downloadLink.href = combinedUrl;
          downloadLink.download = `${sanitisedFileName}.mp3`;
          document.body.appendChild(downloadLink);
          downloadLink.click();
    
          // Clean up: remove the link and revoke the object URL
          document.body.removeChild(downloadLink);
          URL.revokeObjectURL(combinedUrl);
        } catch (error) {
          console.error("Error downloading combined file:", error);
        }
      }, [blobs])

      
    useEffect(() => {
        currentStreamChunkNdxRef.current = currentCompletedStream?.chunkNdx;

        if (promptPausedRef.current) return;

        if (currentCompletedStream?.chunkNdx != (nextChunkRef.current - 1)) {
            if (chunkNumList.current.has(nextChunkRef.current-1)) return;
            const chunk = chunks[nextChunkRef.current-1];
            if (chunk) {
                chunkNumList.current.add(nextChunkRef.current-1);
                setCurrentChunkBeingPromptedIndex(
                    nextChunkRef.current-1
                );
                injectPrompt(chunk.text, chunk.id, promptNdx.current);
            }
            return;
        }

        if (!isDownload) {
            setAudioUrls(completedStreams);
            const chunkNumber = currentCompletedStream?.chunkNdx;
            if (chunkNumber && +chunkNumber > 0 && +chunkNumber < chunks.length - 1 && (((+chunkNumber + 1) % CHUNK_TO_PAUSE_ON) === 0)) {
                const isFirefox = /firefox/i.test(navigator.userAgent);
                if (isFirefox) {
                    setIsPromptingPaused(true);
                    setWasPromptStopped("PAUSED");
                }
                return;
            }
        }

        if (completedStreams.length > 0 ) {
            if (
                currentCompletedStream?.chunkNdx != null &&
                +currentCompletedStream.chunkNdx !== chunks.length - 1
            ) {
                const nextChunk = chunks[+currentCompletedStream.chunkNdx + 1];
                if (nextChunk && !chunkNumList.current.has(+currentCompletedStream.chunkNdx + 1)) {
                    chunkNumList.current.add(+currentCompletedStream.chunkNdx + 1);
                    setCurrentChunkBeingPromptedIndex(
                        +currentCompletedStream.chunkNdx + 1
                    );
                    injectPrompt(nextChunk.text, nextChunk.id, promptNdx.current);
                    nextChunkRef.current += 1;
                }
            }
        }
    }, [currentCompletedStream])

    return { downloadPreviewText, downloadCombinedFile, progress, setProgress, blobs, isFetching, wasPromptStopped, setWasPromptStopped, chunks, voices, setVoices, isVoiceLoading, text, audioUrls, setAudioUrls, extractText, splitAndSendPrompt, ended: currentCompletedStream?.chunkNdx != null && +currentCompletedStream?.chunkNdx === chunks.length - 1, isLoading, setIsLoading, reset, is9ThChunk, reStartChunkProcess, setIs9thChunk, isPromptingPaused, setIsPromptingPaused }

}

export default useAudioUrl;
