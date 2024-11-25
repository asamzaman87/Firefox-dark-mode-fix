import { Button } from "@/components/ui/button";
import { FileUploader } from "@/components/ui/file-uploader";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import useAudioPlayerNew from "@/hooks/use-audio-player";
import { ACCEPTED_FILE_TYPES, MAX_FILES, MAX_FILE_SIZE, TOAST_STYLE_CONFIG } from "@/lib/constants";
import { cn, removeAllListeners } from "@/lib/utils";
import { ArrowLeft } from "lucide-react";
import InputPopup from "./input-popup/popup";
import Previews from "./previews";
import VoiceSelector from "./voice-selector";
import { InputFormProps } from "./input-popup/input-form";
import { FC, useEffect, useMemo, useState } from "react";
import { PromptProps } from ".";
import { toast } from "sonner";
import Player from "./player";
import { DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface ContentProps {
    setPrompts: (prompts: PromptProps[]) => void;
    prompts: PromptProps[];
}

const Content: FC<ContentProps> = ({ setPrompts, prompts }) => {
    const [file, setFile] = useState<File | null>(null);
    const { isBackPressed, setIsBackPressed, pause, play, extractText, splitAndSendPrompt, text, isPlaying, isLoading, reset, isPaused, playRate, handlePlayRateChange, voices, setVoices, hasCompletePlaying, setHasCompletePlaying } = useAudioPlayerNew();

    const resetter = () => {
        reset(true);
        setFile(null);
        setPrompts([]);
    }

    const onBackClick = () => {
        resetter();
        setIsBackPressed(true);
    }

    useEffect(() => {
        return () => {
            resetter();
            removeAllListeners(); //removing all listeners to avoid listening to stream events after reset (when the overlay is closed)
        }
    }, [])

    const onSave = (files: File[]) => {
        if (!files?.length) return toast.error("No files selected!", { style: TOAST_STYLE_CONFIG });
        if (isBackPressed) setIsBackPressed(false) //reseting back pressed state if the file is added
        setFile(files[0]);
        extractText(files[0])
    }

    useMemo(() => {
        if (text?.trim()?.length) {
            setPrompts([{ text }])
        } else {
            setPrompts([])
        }
    }, [text])

    const onFormSubmit: InputFormProps["onSubmit"] = (values) => {
        if (isBackPressed) setIsBackPressed(false); //reseting back pressed state if the form is submitted
        splitAndSendPrompt(values.text)
    }

    const logo = chrome.runtime.getURL('logo-128.png');

    return (
        <>
            <DialogHeader className={cn("h-max", prompts?.length && "sr-only")}>
                <DialogTitle className="inline-flex flex-col justify-center items-center gap-2"><img src={logo} alt="GPT Reader Logo" className="size-10" />GPT Reader</DialogTitle>
                <DialogDescription className="sr-only">Simplify reading long documents with GPT</DialogDescription>
            </DialogHeader>
            <div className="flex size-full flex-col justify-center gap-6 overflow-hidden" >
                <div className={cn("absolute top-4 left-4 size-max", { "translate-y-16 transition-transform": prompts.length > 0 })}>
                    <ThemeToggle />
                </div>

                {prompts.length === 0 ? <VoiceSelector disabled={isPlaying} voice={voices} setVoices={setVoices} /> : null}

                {prompts.length > 0 && <Button title="Back" size={"icon"} onClick={onBackClick} className="font-medium absolute top-4 left-4 rounded-full border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 [&_svg]:size-6"><ArrowLeft /><span className="sr-only">Back</span></Button>}

                {
                    prompts.length > 0 ?
                        <Previews file={file} content={text} />
                        : <FileUploader
                            disabled={isPlaying}
                            accept={ACCEPTED_FILE_TYPES}
                            maxFileCount={MAX_FILES}
                            maxSize={MAX_FILE_SIZE}
                            onValueChange={onSave}
                        />
                }

                <Player showControls={prompts.length > 0} hasPlayBackEnded={hasCompletePlaying} setHasPlayBackEnded={setHasCompletePlaying} isPaused={isPaused} isPlaying={isPlaying} isLoading={isLoading} play={play} pause={pause} handlePlayRateChange={handlePlayRateChange} playRate={playRate} />

                {
                    !prompts?.length ?
                        <InputPopup disabled={isPlaying} onSubmit={onFormSubmit} />
                        : null
                }
            </div >
        </>

    )
}

export default Content;