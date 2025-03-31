import { Button } from "@/components/ui/button";
import { DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FileUploader } from "@/components/ui/file-uploader";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import useAudioPlayer from "@/hooks/use-audio-player";
import { useToast } from "@/hooks/use-toast";
import { ACCEPTED_FILE_TYPES, ACCEPTED_FILE_TYPES_FIREFOX, MAX_FILES, MAX_FILE_SIZE, TOAST_STYLE_CONFIG } from "@/lib/constants";
import { cn, detectBrowser, removeAllListeners } from "@/lib/utils";
import { ArrowLeft, HelpCircleIcon } from "lucide-react";
import { FC, memo, useCallback, useEffect, useMemo, useState } from "react";
import { PromptProps } from ".";
import DownloadOrListen from "./download-or-listen-popup";
import FeedbackPopup from "./feedback-popup";
import { InputFormProps } from "./input-popup/input-form";
import InputPopup from "./input-popup/popup";
import Player from "./player";
import PresenceConfirmationPopup from "./presence-confirmation-popup";
import Previews from "./previews";
import VoiceSelector from "./voice-selector";

interface ContentProps {
    setPrompts: (prompts: PromptProps[]) => void;
    prompts: PromptProps[];
    onOverlayOpenChange: (open: boolean) => void;
    isCancelDownloadConfirmation: boolean;
    setIsCancelDownloadConfirmation: (state: boolean) => void;
}

const BROWSER = detectBrowser();
const logo = chrome.runtime.getURL('logo-128.png');

const Content: FC<ContentProps> = ({ setPrompts, prompts, onOverlayOpenChange, isCancelDownloadConfirmation, setIsCancelDownloadConfirmation }) => {
    const { toast } = useToast();
    const [isDownload, setIsDownload] = useState<boolean>(false);
    const [files, setFiles] = useState<File[]>([]);
    const [title, setTitle] = useState<string>();
    const [pastedText, setPastedText] = useState<string>();
    const [showDownloadOrListen, setShowDownloadOrListen] = useState<boolean>(false);
    const [fileExtractedText, setFileExtractedText] = useState<string>(); //ToDo: to find a better way to handle this
    const [showDownloadCancelConfirmation, setShowDownloadCancelConfirmation] = useState<boolean>(false);
    const { downloadPreviewText, progress, setProgress, downloadCombinedFile, isFetching, isPresenceModalOpen, setIsPresenceModalOpen, isBackPressed, setIsBackPressed, pause, play, extractText, splitAndSendPrompt, text, isPlaying, isLoading, reset, isPaused, playRate, handlePlayRateChange, voices, setVoices, hasCompletePlaying, setHasCompletePlaying, isVoiceLoading, reStartChunkProcess, isStreamLoading } = useAudioPlayer(isDownload);

    useMemo(() => {
        if(isCancelDownloadConfirmation) setShowDownloadCancelConfirmation(true);
    }, [isCancelDownloadConfirmation])

    const resetDownloader= ()=>{
        setIsDownload(false);
        setIsCancelDownloadConfirmation(false)
        setShowDownloadCancelConfirmation(false)
        setProgress(0);
        setIsBackPressed(true); //to avoid unnecessary audio play on cancel download
        localStorage.removeItem("gptr/download");
    }

    const resetter = () => {
        reset(true);
        setFiles([]);
        setPrompts([]);
        setTitle(undefined);
        resetDownloader();
    }

    const onBackClick = () => {
        if(isDownload && localStorage.getItem("gptr/download") === "true") return setShowDownloadCancelConfirmation(true);
        //if is playing, wait for 500ms before resetting to avoid further chunk from being sent (May not work with 2g-3g networks)
        if(isPlaying){
            setTimeout(()=>{
                resetter();
            }, 500)
        }else{
            resetter();
        }
        setIsBackPressed(true);
    }

    useEffect(() => {
        return () => {
            resetter();
            removeAllListeners(); //removing all listeners to avoid listening to stream events after reset (when the overlay is closed)
        }
    }, [])

    const onSave = (files: File[]) => {
        if (!files?.length) return toast({ description: chrome.i18n.getMessage("no_files_selected"), style: TOAST_STYLE_CONFIG });
        if (isBackPressed) setIsBackPressed(false) //reseting back pressed state if the file is added
        setFiles(files);
        extractText(files[0]).then((text) => {
            setTitle(files[0].name);
            setFileExtractedText(text);
            setShowDownloadOrListen(true)
        }).catch((e) => {
            toast({ description: e.message, style: TOAST_STYLE_CONFIG });
            resetter();
        })
    }

    useMemo(() => {
        if (text?.trim()?.length && !isDownload) {
            setPrompts([{ text }])
        } else {
            setPrompts([])
        }
    }, [text])

    const onFormSubmit: InputFormProps["onSubmit"] = (values) => {
        if (isBackPressed) setIsBackPressed(false); //reseting back pressed state if the form is submitted
        setTitle(values.title?.trim().length ? values.title + ".txt" : chrome.i18n.getMessage("untitled_file"));
        setPastedText(values.text)
        setShowDownloadOrListen(true)
    }

    const listenOrDownloadAudio = useCallback(async () => {
        if (files.length > 0 && fileExtractedText?.trim()?.length) {
            return splitAndSendPrompt(fileExtractedText).finally(() => {
                setShowDownloadOrListen(false);
            });
        }
        if (pastedText?.trim().length && !files.length) {
            return splitAndSendPrompt(pastedText).finally(() => {
                setShowDownloadOrListen(false);
            });
        }
    }, [pastedText, files, fileExtractedText]);

    const onDownloadOrListenSubmit = useCallback(async (value: "DOWNLOAD" | "LISTEN") => {
        if(value === "DOWNLOAD"){
            setIsDownload(value === "DOWNLOAD");
            localStorage.setItem("gptr/download", "true");
        }
        listenOrDownloadAudio()
    }, [listenOrDownloadAudio]);

    const handleDownload = () => {
        const fileName = title ?? "gpt-reader-audio.aac";
        downloadCombinedFile(fileName);
    }

    //handles the yes button click to resume the player
    const handleYes = () => {
        reStartChunkProcess()
    }

    //resets the player on click of presence confirmation popup no button
    const handleNo = () => {
        resetter();
        onOverlayOpenChange(false);
    }

    const onDownloadCancel = useCallback(() => {
        resetter();
        if(isCancelDownloadConfirmation){
            setIsCancelDownloadConfirmation(false);
            onOverlayOpenChange(false); //Close overlay if download cancellled from close button
        }
        setShowDownloadCancelConfirmation(false);
    }, [resetter, setShowDownloadCancelConfirmation])

    const onContinueDownload = useCallback((state: boolean) => {
       if(!state) setIsCancelDownloadConfirmation(state); //resetting the state if user clicks on no after triggering the confirmation by the close button
        setShowDownloadCancelConfirmation(state);
    }, [resetter])

    return (
        <>
            <DialogHeader className={cn("h-max", { "sr-only": isDownload })}>
                <DialogTitle className={"inline-flex flex-col justify-center items-center gap-2"}>
                    {title ? title
                        : <>{!prompts.length && <img src={logo} alt={chrome.i18n.getMessage("gpt_reader_logo")} className="size-10" />} {chrome.i18n.getMessage("gpt_reader")}</>}
                </DialogTitle>
                <DialogDescription className="sr-only">{chrome.i18n.getMessage("simplify_reading")}</DialogDescription>
            </DialogHeader>
            <div className="flex size-full flex-col justify-center gap-6 overflow-hidden" >
                <div className={cn("absolute top-4 left-4 size-max", { "translate-x-14 transition-transform": (prompts.length > 0 || isDownload )})}>
                    <ThemeToggle />
                </div>
                <div className={cn("absolute top-4 left-16 size-max", { "translate-x-16 transition-transform":( prompts.length > 0 || isDownload)})}>
                    <FeedbackPopup />
                </div>
                <div className={cn("absolute top-4 right-16 size-max")}>
                    <Button variant="ghost" onClick={()=> chrome.runtime.sendMessage({ type: "OPEN_FAQ_VIDEO" })} className="rounded-full border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 [&_svg]:size-6 transition-all">
                        <HelpCircleIcon/> {chrome.i18n.getMessage("having_issues")}
                    </Button>
                </div>

                 <PresenceConfirmationPopup loading={isLoading} handleYes={handleYes} handleNo={handleNo} open={isPresenceModalOpen} setOpen={setIsPresenceModalOpen} />       
                 <DownloadOrListen onSubmit={onDownloadOrListenSubmit} open={showDownloadOrListen} onOpenChange={(state)=>{
                    if(!state) resetter()
                    setShowDownloadOrListen(state);
                }} />

                {(prompts.length === 0 && !isDownload) ? <VoiceSelector voice={voices} setVoices={setVoices} disabled={isVoiceLoading} loading={isVoiceLoading} /> : null}

                {(prompts.length > 0 || isDownload) && <Button title={chrome.i18n.getMessage("back")} size={"icon"} onClick={onBackClick} className="hover:scale-110  transition-allfont-medium absolute top-4 left-4 rounded-full border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 [&_svg]:size-6"><ArrowLeft /><span className="sr-only">{chrome.i18n.getMessage("back")}</span></Button>}
                    
                {
                    (prompts.length > 0 || isDownload) ?
                        <Previews setDownloadCancelConfirmation={onContinueDownload} downloadCancelConfirmation={showDownloadCancelConfirmation} downloadPreviewText={downloadPreviewText} onDownload={handleDownload} onDownloadCancel={onDownloadCancel} file={files[0]} content={text} isDowloading={isDownload} progress={progress} />
                        : <FileUploader
                            value={files}
                            disabled={isPlaying || isFetching}
                            accept={BROWSER === "firefox" ? ACCEPTED_FILE_TYPES_FIREFOX : ACCEPTED_FILE_TYPES}
                            maxFileCount={MAX_FILES}
                            maxSize={MAX_FILE_SIZE}
                            onValueChange={onSave}
                        />
                }

                <Player isFirstChunk={isLoading} showControls={prompts.length > 0} hasPlayBackEnded={hasCompletePlaying} setHasPlayBackEnded={setHasCompletePlaying} isPaused={isPaused} isPlaying={isPlaying} isLoading={isLoading || isStreamLoading} play={play} pause={pause} handlePlayRateChange={handlePlayRateChange} playRate={playRate} />

                {
                    (!prompts?.length && !isDownload) ?
                        <InputPopup disabled={isPlaying || isFetching} onSubmit={onFormSubmit} />
                        : null
                }
            </div>
        </>

    )
}

export default memo(Content, (p,n)=>p.isCancelDownloadConfirmation === n.isCancelDownloadConfirmation && p.prompts === n.prompts);