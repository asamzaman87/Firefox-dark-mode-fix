import { CHUNK_SIZE, CHUNK_TO_PAUSE_ON, HELPER_PROMPT, LISTENERS, PROMPT_INPUT_ID, TOAST_STYLE_CONFIG } from "@/lib/constants";
import { Chunk, splitIntoChunksV1, splitIntoChunksV2 } from "@/lib/utils";
import { useCallback, useEffect, useMemo, useState } from "react";
import useFileReader from "./use-file-reader";
import useStreamListener from "./use-stream-listener";
import { useToast } from "./use-toast";

const useAudioUrl = (isDownload: boolean) => {
    const { toast } = useToast();
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
    const {blobs, isFetching, completedStreams, currentCompletedStream, reset: resetStreamListener, setVoices, voices, isVoiceLoading } = useStreamListener(setIsLoading);

    useMemo(() => {
        if (blobs.length === 0) {
          setProgress(0);
          setDownloadPreviewText(undefined);
          return;
        }
        if(currentCompletedStream){
            const text = chunks[+currentCompletedStream?.chunkNumber]?.text ?? "";
            setDownloadPreviewText(t => (t ?? "")  + `${text.replaceAll("\n", " ") ?? ""}`);
        }
        setProgress(((blobs.length ?? 0) / (chunks.length ?? 0)) * 100);
      }, [chunks, blobs,currentCompletedStream]);

      
    const sendPrompt = async () => {
        //console.log("SEND_PROMPT");
        setIsLoading(true);
        const sendButton: HTMLButtonElement | null = document.querySelector("[data-testid='send-button']");
        // toast({ description:"It seems that ChatGPT might be either displaying an error, generating a prompt, or you've reached your hourly limit. Please check on the ChatGPT website for the exact error.", style: TOAST_STYLE_CONFIG });
        if (!sendButton) return
        sendButton.click();
    };

    const stopPrompt = async () => {
        //console.log("STOP_PROMPT");
        const stopButton: HTMLButtonElement | null = document.querySelector("[data-testid='stop-button']");
        if (stopButton) {
            stopButton.click();
        }
    };

    const injectPrompt = useCallback((text: string, id: string) => {
        //console.log("INJECT_PROMPT", id);
        const textarea = document.querySelector(PROMPT_INPUT_ID) as HTMLTextAreaElement;
        if (textarea) {
            textarea.innerHTML = `<p>[${id}] ${HELPER_PROMPT}</p><p></p><p>${text}</p>`;
            setTimeout(() => {
                sendPrompt();
            }, 200);
        } else {
            window.dispatchEvent(new CustomEvent(LISTENERS.ERROR, { detail: { message: "ChatGPT seems to be having issues, please check the ChatGPT website for the exact issue." } }));
            toast({
                description: "ChatGPT seems to be having issues, please check the ChatGPT website for the exact issue.",
                style: TOAST_STYLE_CONFIG
            })
        }
    }, []);

    const splitAndSendPrompt = async (text: string) => {
        //console.log("SPLIT_AND_SEND_PROMPT");
        setText(text);
        const textWithoutTags = text.replace(/<img[^>]*src\s*=\s*["']\s*data:image\/[a-zA-Z]+;base64,[^"']*["'][^>]*>/gi, ''); //removes image tag if it exist in the prompt
        const chunks: Chunk[] = await splitIntoChunksV2(textWithoutTags, CHUNK_SIZE);
        if (chunks.length > 0) {
            setCurrentChunkBeingPromptedIndex(currentChunkBeingPromptedIndex);
            setChunks(chunks);
            injectPrompt(chunks[0].text, chunks[0].id);
        }
        return
    };

    const extractText = async (file: File) => {
        //console.log("EXTRACT_TEXT");
        switch (file.type) {
            case "application/pdf": {
                // const text = await pdfToText(file);
                // splitAndSendPrompt(text);
                return await pdfToText(file);
            }
            case "application/msword":
            case "application/vnd.openxmlformats-officedocument.wordprocessingml.document": {
                // const text = await docxToText(file);
                // splitAndSendPrompt(text);
                return await docxToText(file);
            }
            case "text/plain":
            case "text/rtf": {
                // const text = await textPlainToText(file);
                // splitAndSendPrompt(text);
                return await textPlainToText(file);
            }
            default:
                toast({ description: "Unsupported file type", style: TOAST_STYLE_CONFIG });
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
        if(isDownload){
            setProgress(0);
            setDownloadPreviewText(undefined);
        }
    }

    useMemo(() => {
        if(!isDownload){
            const chunkNumber = currentCompletedStream?.chunkNumber;
            if (chunkNumber && +chunkNumber > 0 && +chunkNumber < chunks.length - 1 && (((+chunkNumber + 1) % CHUNK_TO_PAUSE_ON) === 0)) {
                setIsPromptingPaused(true);
                setWasPromptStopped("PAUSED");
            }
        }
    }, [currentCompletedStream, chunks]);

    const reStartChunkProcess = () => {
        const nextChunk = chunks[currentChunkBeingPromptedIndex + 1];
        if (nextChunk && currentCompletedStream) {
            //console.log("RESTART WITH NEXT_CHUNK");
            setIsPromptingPaused(false);
            setCurrentChunkBeingPromptedIndex(+currentCompletedStream.chunkNumber + 1);
            injectPrompt(nextChunk.text, nextChunk.id);
        }
    };

   const downloadCombinedFile = useCallback(async(fileName: string) => {
        try {
          const sanitisedFileName = fileName.split('.').slice(0, -1).join('.');
          // The Blob constructor automatically concatenates the provided blob parts.
          const combinedBlob = new Blob(blobs, {
            type: blobs[0]?.type || "audio/aac",
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
        if (completedStreams.length > 0 ) {
            if(!isDownload) setAudioUrls(completedStreams);
            if (
                currentCompletedStream?.chunkNumber &&
                +currentCompletedStream.chunkNumber !== chunks.length - 1 && !isPromptingPaused
            ) {
                const nextChunk = chunks[+currentCompletedStream.chunkNumber + 1];
                if (nextChunk) {
                    //console.log("NEXT_CHUNK");
                    setCurrentChunkBeingPromptedIndex(
                        +currentCompletedStream.chunkNumber + 1
                    );
                    injectPrompt(nextChunk.text, nextChunk.id);
                }
            }
        }
    }, [chunks, completedStreams, currentChunkBeingPromptedIndex, currentCompletedStream, injectPrompt, voices.selected, isPromptingPaused])

    return { downloadPreviewText,downloadCombinedFile,progress, setProgress, blobs, isFetching, wasPromptStopped, setWasPromptStopped, chunks, voices, setVoices, isVoiceLoading, text, audioUrls, setAudioUrls, extractText, splitAndSendPrompt, ended: currentCompletedStream?.chunkNumber && +currentCompletedStream?.chunkNumber === chunks.length - 1, isLoading, setIsLoading, reset, is9ThChunk, reStartChunkProcess, setIs9thChunk, isPromptingPaused, setIsPromptingPaused }

}

export default useAudioUrl