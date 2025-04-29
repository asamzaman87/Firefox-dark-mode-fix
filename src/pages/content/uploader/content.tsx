import { Button } from "@/components/ui/button";
import { DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FileUploader } from "@/components/ui/file-uploader";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import useAudioPlayer from "@/hooks/use-audio-player";
import { useToast } from "@/hooks/use-toast";
import { ACCEPTED_FILE_TYPES, ACCEPTED_FILE_TYPES_FIREFOX, MAX_FILES, MAX_FILE_SIZE, TOAST_STYLE_CONFIG } from "@/lib/constants";
import { cn, detectBrowser, removeAllListeners } from "@/lib/utils";
import { ArrowLeft, DownloadCloud, HelpCircleIcon, InfoIcon } from "lucide-react";
import { FC, memo, useCallback, useEffect, useMemo, useState } from "react";
import { PromptProps } from ".";
import Announcements from "./announcements-popup";
import DownloadOrListen from "./download-or-listen-popup";
import FeedbackPopup from "./feedback-popup";
import { InputFormProps } from "./input-popup/input-form";
import InputPopup from "./input-popup/popup";
import PlayerBackup from "./player";
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
    const [isDownloadConfirmationOpen, setIsDownloadConfirmationOpen] = useState<boolean>(false);
    const { isTypeAACSupported, replay, partialChunkCompletedPlaying, showInfoToast, playTimeDuration, currentPlayTime, onScrub, handleVolumeChange, volume, onForward, onRewind, downloadPreviewText, progress, setProgress, downloadCombinedFile, isFetching, isPresenceModalOpen, setIsPresenceModalOpen, isBackPressed, setIsBackPressed, pause, play, extractText, splitAndSendPrompt, text, isPlaying, isLoading, reset, isPaused, playRate, handlePlayRateChange, voices, setVoices, hasCompletePlaying, setHasCompletePlaying, isVoiceLoading, reStartChunkProcess } = useAudioPlayer(isDownload);
    
    useMemo(() => {
        if (isCancelDownloadConfirmation) setShowDownloadCancelConfirmation(true);
    }, [isCancelDownloadConfirmation])

    const resetDownloader = () => {
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
        if (isDownload && localStorage.getItem("gptr/download") === "true") return setShowDownloadCancelConfirmation(true);
        //if is playing, wait for 500ms before resetting to avoid further chunk from being sent (May not work with 2g-3g networks)
        if (isPlaying) {
            setTimeout(() => {
                resetter();
            }, 500)
        } else {
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
        if (value === "DOWNLOAD") {
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
    const handleYes = useCallback(() => {
        reStartChunkProcess()
    }, [reStartChunkProcess]);

    //resets the player on click of presence confirmation popup no button
    const handleNo = useCallback(() => {
        resetter();
        onOverlayOpenChange(false);
    },[onOverlayOpenChange, resetter]);

    const onDownloadCancel = useCallback(() => {
        resetter();
        if (isCancelDownloadConfirmation) {
            setIsCancelDownloadConfirmation(false);
            onOverlayOpenChange(false); //Close overlay if download cancellled from close button
        }
        setShowDownloadCancelConfirmation(false);
    }, [resetter, setShowDownloadCancelConfirmation])

    const onContinueDownload = useCallback((state: boolean) => {
        if (!state) setIsCancelDownloadConfirmation(state); //resetting the state if user clicks on no after triggering the confirmation by the close button
        setShowDownloadCancelConfirmation(state);
    }, [resetter])

    return (
        <>
            <DialogHeader className={cn("h-max", { "sr-only": isDownload })}>
                <DialogTitle className={"inline-flex flex-col justify-center items-center gap-2"}>
                    {title ?
                        <div className="inline-flex justify-center w-full items-center gap-3">
                            <p className="truncate max-w-[20dvw]">{title}</p>
                            <Popover onOpenChange={setIsDownloadConfirmationOpen} open={isDownloadConfirmationOpen}>
                                <PopoverTrigger asChild>
                                    <div className="relative size-10 hover:scale-115 active:scale-105 transition-all cursor-pointer">
                                        <Button
                                            disabled={!isPaused && !isPlaying}
                                            variant="ghost"
                                            size={"icon"}
                                            className="absolute top-1/2 start-1/2 transform -translate-y-1/2 -translate-x-1/2 rounded-full [&_svg]:size-6"
                                        >
                                            <DownloadCloud />
                                        </Button>
                                        <svg className="size-full -rotate-90" viewBox="0 0 36 36" xmlns="http://www.w3.org/2000/svg">
                                            <circle cx="18" cy="18" r="16" fill="none" className="transition-all ease-in-out stroke-current text-gray-800 dark:text-gray-100" strokeWidth="2"></circle>
                                            <circle cx="18" cy="18" r="16" fill="none" className="transition-all ease-in-out stroke-current text-gray-100 dark:text-gray-700" strokeWidth="2" strokeDasharray="100" strokeDashoffset={progress} strokeLinecap="square"></circle>
                                        </svg>
                                    </div>
                                    {/* <span className={cn("absolute transition-all left-0 bottom-0 bg-blue-800 w-full max-h-full", { "bg-green-600": progress === 100 })} style={{ height: `${progress}%` }}></span> */}
                                </PopoverTrigger>
                                <PopoverContent className="bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                                    <div className="flex flex-col gap-2">
                                        <p className="text-wrap">{chrome.i18n.getMessage("download_confirm")}</p>
                                        <div className="flex gap-4 w-full justify-center flex-wrap">
                                            <Button
                                                variant="ghost"
                                                className="flex-auto border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 [&_svg]:size-6 transition-all"
                                                onClick={() => { handleDownload(); setIsDownloadConfirmationOpen(false) }}
                                            >
                                                {chrome.i18n.getMessage("yes")}
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                className="flex-auto border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 [&_svg]:size-6 transition-all"
                                                onClick={() => setIsDownloadConfirmationOpen(false)}
                                            >
                                                {chrome.i18n.getMessage("no")}
                                            </Button>
                                        </div>
                                    </div>
                                </PopoverContent>
                            </Popover>
                        </div>
                        : <>{!prompts.length && <img src={logo} alt={chrome.i18n.getMessage("gpt_reader_logo")} className="size-10" />} {chrome.i18n.getMessage("gpt_reader")}</>}
                </DialogTitle>
                <DialogDescription className="sr-only">{chrome.i18n.getMessage("simplify_reading")}</DialogDescription>
            </DialogHeader>
            <div className="flex size-full flex-col justify-center gap-6 overflow-hidden" >
                <div className={cn("absolute top-4 left-4 size-max flex gap-2 items-center justify-center", { "translate-x-12 transition-transform": (prompts.length > 0 || isDownload) })}>
                    <ThemeToggle />
                    <FeedbackPopup />
                    <Announcements />
                </div>
                <div className={cn("absolute top-4 right-16 size-max")}>
                    <Button variant="ghost" onClick={() => chrome.runtime.sendMessage({ type: "OPEN_FAQ_VIDEO" })} className="rounded-full border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 [&_svg]:size-6 transition-all">
                        <HelpCircleIcon /> {chrome.i18n.getMessage("having_issues")}
                    </Button>
                </div>

                <PresenceConfirmationPopup loading={isLoading} handleYes={handleYes} handleNo={handleNo} open={isPresenceModalOpen} setOpen={setIsPresenceModalOpen} />
                <DownloadOrListen onSubmit={onDownloadOrListenSubmit} open={showDownloadOrListen} onOpenChange={(state) => {
                    if (!state) resetter()
                    setShowDownloadOrListen(state);
                }} />

                {(prompts.length === 0 && !isDownload) ? <VoiceSelector voice={voices} setVoices={setVoices} disabled={isVoiceLoading} loading={isVoiceLoading} /> : null}

                {(prompts.length > 0 || isDownload) && <Button title={chrome.i18n.getMessage("back")} size={"icon"} onClick={onBackClick} className="hover:scale-115 active:scale-105  transition-all font-medium absolute top-4 left-4 rounded-full border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 [&_svg]:size-6"><ArrowLeft /><span className="sr-only">{chrome.i18n.getMessage("back")}</span></Button>}

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

                {/* <Player currentTime={currentPlayTime} duration={playTimeDuration} handleVolumeChange={handleVolumeChange} volume={volume} onForward={onForward} onRewind={onRewind} isFirstChunk={isLoading} showControls={prompts.length > 0} hasPlayBackEnded={hasCompletePlaying} setHasPlayBackEnded={setHasCompletePlaying} isPaused={isPaused} isPlaying={isPlaying} isLoading={isLoading || isStreamLoading} play={play} pause={pause} handlePlayRateChange={handlePlayRateChange} playRate={playRate} /> */}
                <PlayerBackup areSeekControlsAvailable={isTypeAACSupported} replay={replay} partialChunkCompletedPlaying={partialChunkCompletedPlaying} setPlaybackEnded={setHasCompletePlaying} showControls={prompts.length > 0} playRate={playRate} handlePlayRateChange={handlePlayRateChange} playbackEnded={hasCompletePlaying} isPaused={isPaused} isLoading={isLoading || isFetching} volume={volume} handleVolumeChange={handleVolumeChange} onScrub={onScrub} play={play} pause={pause} currentTime={currentPlayTime} duration={playTimeDuration} isPlaying={isPlaying} onForward={onForward} onRewind={onRewind} />

                {
                    (!prompts?.length && !isDownload) ?
                        <InputPopup disabled={isPlaying || isFetching} onSubmit={onFormSubmit} />
                        : null
                }
                {prompts.length > 0 && !isDownload && <InfoIcon onClick={() => showInfoToast(5000)} className={cn("z-[51] hover:cursor-pointer absolute bottom-4 right-4 rounded-full hover:scale-115 active:scale-105 transition-all size-6")} />}
            </div>
        </>

    )
}

export default memo(Content, (p, n) => p.isCancelDownloadConfirmation === n.isCancelDownloadConfirmation && p.prompts === n.prompts);