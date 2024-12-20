import { CHUNK_SIZE, CHUNK_TO_PAUSE_ON, HELPER_PROMPT, PROMPT_INPUT_ID, TOAST_STYLE_CONFIG } from "@/lib/constants";
import { Chunk, splitIntoChunksV2 } from "@/lib/utils";
import { useCallback, useEffect, useState } from "react";
import useFileReader from "./use-file-reader";
import useStreamListener from "./use-stream-listener";
import { useToast } from "./use-toast";

const useAudioUrl = () => {
    const { toast } = useToast();
    const [audioUrls, setAudioUrls] = useState<string[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [text, setText] = useState<string>("");
    const [chunks, setChunks] = useState<Chunk[]>([]);
    const [currentChunkBeingPromptedIndex, setCurrentChunkBeingPromptedIndex] = useState<number>(0);
    const [is9ThChunk, setIs9thChunk] = useState<boolean>(false);
    const { pdfToText, docxToText, textPlainToText } = useFileReader();
    const { completedStreams, currentCompletedStream, reset: resetStreamListener, setVoices, voices, isVoiceLoading } = useStreamListener(setIsLoading);

    const sendPrompt = async () => {
        console.log("SEND_PROMPT");
        setIsLoading(true);
        const sendButton: HTMLButtonElement | null = document.querySelector("[data-testid='send-button']");
        // toast({ description:"It seems that ChatGPT might be either displaying an error, generating a prompt, or you've reached your hourly limit. Please check on the ChatGPT website for the exact error.", style: TOAST_STYLE_CONFIG });
        if (!sendButton) return
        sendButton.click();
    };

    const stopPrompt = async () => {
        console.log("STOP_PROMPT");
        const stopButton: HTMLButtonElement | null = document.querySelector("[data-testid='stop-button']");
        if (stopButton) {
            stopButton.click();
        }
    };

    const injectPrompt = useCallback((text: string, id: string) => {
        console.log("INJECT_PROMPT", id);
        const textarea = document.querySelector(PROMPT_INPUT_ID) as HTMLTextAreaElement;
        if (textarea) {
            textarea.innerHTML = `<p>[${id}] ${HELPER_PROMPT}</p><p></p><p>${text}</p>`;
            setTimeout(() => {
                sendPrompt();
            }, 200);
        } else {
            toast({
                description: "ChatGPT seems to be having issues, please check the ChatGPT website for the exact issue.",
                style: TOAST_STYLE_CONFIG
            })
        }
    }, []);

    const splitAndSendPrompt = async (text: string) => {
        console.log("SPLIT_AND_SEND_PROMPT");
        setText(text);
        const chunks = await splitIntoChunksV2(text, CHUNK_SIZE);
        if (chunks.length > 0) {
            setCurrentChunkBeingPromptedIndex(currentChunkBeingPromptedIndex);
            setChunks(chunks);
            injectPrompt(chunks[0].text, chunks[0].id);
        }
        return
    };

    const extractText = async (file: File) => {
        console.log("EXTRACT_TEXT");
        switch (file.type) {
            case "application/pdf": {
                const text = await pdfToText(file);
                splitAndSendPrompt(text);
                break;
            }
            case "application/msword":
            case "application/vnd.openxmlformats-officedocument.wordprocessingml.document": {
                const text = await docxToText(file);
                splitAndSendPrompt(text);
                break;
            }
            case "text/plain":
            case "text/rtf": {
                const text = await textPlainToText(file);
                splitAndSendPrompt(text);
                break;
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
    }

    const reStartChunkProcess = () => {
        const nextChunk = chunks[currentChunkBeingPromptedIndex + 1];
        if (nextChunk && currentCompletedStream) {
            console.log("RESTART WITH NEXT_CHUNK");
            setCurrentChunkBeingPromptedIndex(+currentCompletedStream.chunkNumber + 1);
            injectPrompt(nextChunk.text, nextChunk.id);
        }
    };

    useEffect(() => {
        //stop the prompting process if the current chunk is the 9th chunk
        if (
            completedStreams?.length &&
            (completedStreams?.length + 1) % CHUNK_TO_PAUSE_ON === 0 &&
            !is9ThChunk
        ) {
            console.log(`Stopping processing`);
            setIs9thChunk(true);
            return
        }

        if (completedStreams.length > 0) {
            setAudioUrls(completedStreams);
            if (
                currentCompletedStream?.chunkNumber &&
                +currentCompletedStream.chunkNumber !== chunks.length - 1
            ) {
                const nextChunk = chunks[+currentCompletedStream.chunkNumber + 1];
                if (nextChunk) {
                    console.log("NEXT_CHUNK");
                    setCurrentChunkBeingPromptedIndex(
                        +currentCompletedStream.chunkNumber + 1
                    );
                    injectPrompt(nextChunk.text, nextChunk.id);
                }
            }
        }


    }, [chunks, completedStreams, currentChunkBeingPromptedIndex, currentCompletedStream, injectPrompt, voices.selected])

    return { voices, setVoices, isVoiceLoading, text, audioUrls, setAudioUrls, extractText, splitAndSendPrompt, ended: currentCompletedStream?.chunkNumber && +currentCompletedStream?.chunkNumber === chunks.length - 1, isLoading, setIsLoading, reset, is9ThChunk, reStartChunkProcess, setIs9thChunk }

}

export default useAudioUrl