import { Button } from "@/components/ui/button";
import { DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FileUploader } from "@/components/ui/file-uploader";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import useAudioPlayerNew from "@/hooks/use-audio-player";
import { useToast } from "@/hooks/use-toast";
import { ACCEPTED_FILE_TYPES, MAX_FILES, MAX_FILE_SIZE, TOAST_STYLE_CONFIG } from "@/lib/constants";
import { cn, removeAllListeners } from "@/lib/utils";
import { ArrowLeft } from "lucide-react";
import { FC, useEffect, useMemo, useState } from "react";
import { PromptProps } from ".";
import FeedbackPopup from "./feedback-popup";
import { InputFormProps } from "./input-popup/input-form";
import InputPopup from "./input-popup/popup";
import Player from "./player";
import Previews from "./previews";
import VoiceSelector from "./voice-selector";

interface ContentProps {
    setPrompts: (prompts: PromptProps[]) => void;
    prompts: PromptProps[];
}

const Content: FC<ContentProps> = ({ setPrompts, prompts }) => {
    const { toast } = useToast();
    const [files, setFiles] = useState<File[]>([]);
    const [title, setTitle] = useState<string>();
    const { isBackPressed, setIsBackPressed, pause, play, extractText, splitAndSendPrompt, text, isPlaying, isLoading, reset, isPaused, playRate, handlePlayRateChange, voices, setVoices, hasCompletePlaying, setHasCompletePlaying } = useAudioPlayerNew();

    const resetter = () => {
        reset(true);
        setFiles([]);
        setPrompts([]);
        setTitle(undefined);
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
        if (!files?.length) return toast({ description:"No files selected", style: TOAST_STYLE_CONFIG });
        if (isBackPressed) setIsBackPressed(false) //reseting back pressed state if the file is added
        setFiles(files);
        setTitle(files[0].name);
        extractText(files[0]).catch(e => {
            toast({description:e.message, duration: 100000, style: TOAST_STYLE_CONFIG })
            resetter();
        })
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
        setTitle(values.title?.trim().length  ? values.text+".txt" : "Untitled.txt");
        splitAndSendPrompt(values.text);
    }

    const logo = chrome.runtime.getURL('logo-128.png');
    
    return (
        <>
            <DialogHeader className={"h-max"}>
                <DialogTitle className="inline-flex flex-col justify-center items-center gap-2">
                    {title ? title
                    : <>{!prompts.length && <img src={logo} alt="GPT Reader Logo" className="size-10" />} GPT Reader</>}    
                </DialogTitle>
                <DialogDescription className="sr-only">Simplify reading long documents with GPT</DialogDescription>
            </DialogHeader>
            <div className="flex size-full flex-col justify-center gap-6 overflow-hidden" >
                <div className={cn("absolute top-4 left-4 size-max", { "translate-x-14 transition-transform": prompts.length > 0 })}>
                    <ThemeToggle />
                </div>
                <div className={cn("absolute top-4 left-16 size-max", { "translate-x-16 transition-transform": prompts.length > 0 })}>
                    <FeedbackPopup />
                </div>

                {prompts.length === 0 ? <VoiceSelector voice={voices} setVoices={setVoices} /> : null}

                {prompts.length > 0 && <Button title="Back" size={"icon"} onClick={onBackClick} className="hover:scale-110  transition-allfont-medium absolute top-4 left-4 rounded-full border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 [&_svg]:size-6"><ArrowLeft /><span className="sr-only">Back</span></Button>}

                {
                    prompts.length > 0 ?
                        <Previews file={files[0]} content={text} />
                        : <FileUploader
                            value={files}
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