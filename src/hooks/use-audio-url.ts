import { CHUNK_SIZE, CHUNK_TO_PAUSE_ON, HELPER_PROMPT, LISTENERS, PROMPT_INPUT_ID, TOAST_STYLE_CONFIG } from "@/lib/constants";
import { Chunk, splitIntoChunksV2 } from "@/lib/utils";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import useFileReader from "./use-file-reader";
import useStreamListener from "./use-stream-listener";
import { useToast } from "./use-toast";

const useAudioUrl = (isDownload: boolean) => {
    const { toast } = useToast();
    const hasRefusal = useRef<boolean>(false);
    const [audioUrls, setAudioUrls] = useState<string[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [text, setText] = useState<string>("");
    const [chunks, setChunks] = useState<Chunk[]>([]);
    const [currentChunkBeingPromptedIndex, setCurrentChunkBeingPromptedIndex] = useState<number>(0);
    const [is9ThChunk, setIs9thChunk] = useState<boolean>(false);
    const [isPromptingPaused, setIsPromptingPaused] = useState<boolean>(false);
    const [wasPromptStopped, setWasPromptStopped] = useState<"LOADING" | "PAUSED" | "INIT">("INIT");
    const { pdfToText, docxToText, textPlainToText } = useFileReader();
    const [progress, setProgress] = useState<number>(0);
    const [downloadPreviewText, setDownloadPreviewText] = useState<string>();
    const promptPausedRef = useRef(isPromptingPaused);
    const nextChunkRef = useRef<number>(0);
    const chunkNumList = useRef<Set<number>>(new Set());
    const { blobs, isFetching, completedStreams, currentCompletedStream, reset: resetStreamListener, setVoices, voices, isVoiceLoading } = useStreamListener(setIsLoading);
    const currentStreamChunkNdxRef = useRef(currentCompletedStream?.chunkNdx);
    // Refusal detector ───────────────────────────────────────────────────────
    useEffect(() => {
        if (!currentCompletedStream || hasRefusal.current) return;
    
        // Grab the latest ChatGPT reply from the DOM
        let actual = "";
        const mdEls = Array.from(
            document.querySelectorAll<HTMLElement>('div[class*="markdown"]')
        );
        if (mdEls.length) {
            actual = mdEls[mdEls.length - 1].innerText;
        }
        actual = actual.replace(/\s+/g, " ").trim();
    
        // Only trigger error if reply is short (<300 chars) and contains refusal keywords
        if (
            actual.length < 150 &&
            (actual.includes("I cannot") || actual.includes("I can't"))
        ) {
            console.warn("[Refusal Detector] Refusal detected—pausing prompt stream.");
        
            hasRefusal.current = true;
            setIsPromptingPaused(true);
            setWasPromptStopped("PAUSED");
        }
    }, [
        currentCompletedStream,
        setIsPromptingPaused,
        setWasPromptStopped,
        toast,
    ]);

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
        setProgress(((blobs.length ?? 0) / (chunks.length ?? 0)) * 100);
      }, [chunks, blobs,currentCompletedStream]);

    const sendPrompt = () => {
        setIsLoading(true);
    
        const sendButton = document.querySelector("[data-testid='send-button']") as HTMLButtonElement | null;
        if (sendButton && !sendButton.disabled) {
            sendButton.click();
            return;
        }
    
        const observer = new MutationObserver((mutations, obs) => {
            const btn = document.querySelector("[data-testid='send-button']") as HTMLButtonElement | null;
            if (btn && !btn.disabled) {
                btn.click();
                obs.disconnect();
                clearTimeout(timeout);
            }
        });
    
        observer.observe(document.body, { childList: true, subtree: true });
    
        const timeout = setTimeout(() => {
            observer.disconnect();
            console.error("[sendPrompt] Send button not found after 35 seconds.");
        }, 35000);
    };
    
    const stopPrompt = async () => {
        const stopButton: HTMLButtonElement | null = document.querySelector("[data-testid='stop-button']");
        if (stopButton) {
            stopButton.click();
        }
    };

    const injectPrompt = useCallback((text: string, id: string) => {
        const textarea = document.querySelector(PROMPT_INPUT_ID) as HTMLTextAreaElement;
        if (textarea) {
            textarea.focus();
            // 2) build the raw text version (execCommand works better with plain text)
            const raw = `[${id}] ${HELPER_PROMPT}\n\n${text}`;
            // 3) try the non-deprecated insertText
            document.execCommand("selectAll", false, undefined);
            const didInsert = document.execCommand("insertText", false, raw);
            // 4) fallback to HTML if that didn’t take
            if (!didInsert) {
                textarea.innerHTML = `<p>[${id}] ${HELPER_PROMPT}</p><p></p><p>${text}</p>`;
            }
            localStorage.setItem("gptr/is-first-audio-loading", String(id == "0"));
            sendPrompt();
        } else {
            const errorMessage = chrome.i18n.getMessage('chatgpt_issue');
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
            injectPrompt(chunks[0].text, chunks[0].id);
            nextChunkRef.current += 1;
            chunkNumList.current.add(0);
        }
        return
    };

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
                injectPrompt(chunk.text, chunk.id);
            }
            return;
        }
        const nextChunk = chunks[nextChunkRef.current];
        if (nextChunk && !chunkNumList.current.has(nextChunkRef.current)) {
            chunkNumList.current.add(nextChunkRef.current);
            setIsPromptingPaused(false);
            setCurrentChunkBeingPromptedIndex(nextChunkRef.current);
            injectPrompt(nextChunk.text, nextChunk.id);
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
            type: ordered[0]?.type || "audio/aac",
          });
    
          // Create an object URL for the combined blob
          const combinedUrl = URL.createObjectURL(combinedBlob);
    
          // Create a temporary download link and trigger a click to start download
          const downloadLink = document.createElement("a");
          downloadLink.href = combinedUrl;
          downloadLink.download = `${sanitisedFileName}.aac`;
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

        if (hasRefusal.current){
            hasRefusal.current = false;
            return;
        }

        if (promptPausedRef.current) return;

        if (currentCompletedStream?.chunkNdx != (nextChunkRef.current - 1)) {
            if (chunkNumList.current.has(nextChunkRef.current-1)) return;
            const chunk = chunks[nextChunkRef.current-1];
            if (chunk) {
                chunkNumList.current.add(nextChunkRef.current-1);
                setCurrentChunkBeingPromptedIndex(
                    nextChunkRef.current-1
                );
                injectPrompt(chunk.text, chunk.id);
            }
            return;
        }

        if (!isDownload) {
            setAudioUrls(completedStreams);
            const chunkNumber = currentCompletedStream?.chunkNdx;
            if (chunkNumber && +chunkNumber > 0 && +chunkNumber < chunks.length - 1 && (((+chunkNumber + 1) % CHUNK_TO_PAUSE_ON) === 0)) {
                setIsPromptingPaused(true);
                setWasPromptStopped("PAUSED");
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
                    injectPrompt(nextChunk.text, nextChunk.id);
                    nextChunkRef.current += 1;
                }
            }
        }
    }, [currentCompletedStream])

    return { downloadPreviewText,downloadCombinedFile,progress, setProgress, blobs, isFetching, wasPromptStopped, setWasPromptStopped, chunks, voices, setVoices, isVoiceLoading, text, audioUrls, setAudioUrls, extractText, splitAndSendPrompt, ended: currentCompletedStream?.chunkNdx != null && +currentCompletedStream?.chunkNdx === chunks.length - 1, isLoading, setIsLoading, reset, is9ThChunk, reStartChunkProcess, setIs9thChunk, isPromptingPaused, setIsPromptingPaused }

}

export default useAudioUrl;
