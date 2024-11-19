import { AUDIO_FORMAT, CHUNK_SIZE, HELPER_PROMPT, PROMPT_INPUT_ID, SYNTETHIZE_ENDPOINT, TOAST_STYLE_CONFIG, VOICE } from "@/lib/constants";
import { Chunk, splitIntoChunksV2 } from "@/lib/utils";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import useFileReader from "./use-file-reader";
import useStreamListener from "./use-stream-listener";
import useVoice from "./use-voice";

const useAudioUrl = () => {
    const [audioUrls, setAudioUrls] = useState<string[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [text, setText] = useState<string>("");
    const [chunks, setChunks] = useState<Chunk[]>([]);
    const [currentChunkBeingPromptedIndex, setCurrentChunkBeingPromptedIndex] = useState<number>(0);

    const {voices, handleVoiceChange} = useVoice();
    const { pdfToText, docxToText, textPlainToText } = useFileReader();
    const { completedStreams, currentCompletedStream, reset: resetStreamListener } = useStreamListener(setIsLoading);

    const setVoices = (voice: string) => {
        chrome.runtime.sendMessage({ type: "CHANGE_VOICE", voice });
        handleVoiceChange(voice);
    }

    const sendPrompt = async () => {
        console.log("SEND_PROMPT");
        setIsLoading(true);
        const sendButton: HTMLButtonElement | null = document.querySelector("[data-testid='send-button']");
        if (!sendButton) return toast.error("You might have a slow network connection or the page has not yet completed loading. Please refresh the page and try again.", { style: TOAST_STYLE_CONFIG });
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
            toast.error("Could not find textarea element!", { style: TOAST_STYLE_CONFIG });
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
            case "application/vnd.openxmlformats-officedocument.wordprocessingml.document":{
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
                toast.error("Unsupported file type");
                break;
        }
    }

    const reset = () => {
        setAudioUrls([]);
        setCurrentChunkBeingPromptedIndex(0);
        setChunks([]);
        setText("");
        setIsLoading(false);
        resetStreamListener();
        stopPrompt()
    }

    useEffect(() => {
        if (completedStreams.length > 0) {
            const audioUrls = completedStreams.map(stream => `${SYNTETHIZE_ENDPOINT}?conversation_id=${stream.conversationId}&message_id=${stream.messageId}&voice=${voices.selected ?? VOICE}&format=${AUDIO_FORMAT}`);
            console.log("USE_AUDIO_URL", audioUrls.length);
            setAudioUrls(audioUrls);
            if (currentCompletedStream?.chunkNumber && +currentCompletedStream.chunkNumber !== chunks.length - 1) {
                const nextChunk = chunks[+currentCompletedStream.chunkNumber + 1];
                if (nextChunk) {
                    console.log("NEXT_CHUNK", nextChunk);
                    setCurrentChunkBeingPromptedIndex(+currentCompletedStream.chunkNumber + 1);
                    injectPrompt(nextChunk.text, nextChunk.id);
                }
            }
        }
    }, [chunks, completedStreams, currentChunkBeingPromptedIndex, currentCompletedStream, injectPrompt, voices.selected])

    return { voices, setVoices, text, audioUrls, extractText, splitAndSendPrompt, ended: currentCompletedStream?.chunkNumber && +currentCompletedStream?.chunkNumber === chunks.length - 1, isLoading, setIsLoading, reset }

}

export default useAudioUrl