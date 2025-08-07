/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable no-self-assign */
import { Button } from "@/components/ui/button";
import { DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FileUploader } from "@/components/ui/file-uploader";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import useAudioPlayer from "@/hooks/use-audio-player";
import { useToast } from "@/hooks/use-toast";
import { ACCEPTED_FILE_TYPES, ACCEPTED_FILE_TYPES_FIREFOX, MAX_FILES, MAX_FILE_SIZE, TOAST_STYLE_CONFIG, TOAST_STYLE_CONFIG_INFO } from "@/lib/constants";
import { cn, detectBrowser, removeAllListeners } from "@/lib/utils";
import { ArrowLeft, DownloadCloud, HelpCircleIcon, InfoIcon, Crown } from "lucide-react";
import { FC, memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { usePremiumModal } from "@/context/premium-modal";
import CancelPremiumPopup from "./cancel-premium-popup";
import TimerPopup from "./timer-popup";
import PremiumModal from "./premium-modal";

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
    const [inputPopupOpen, setInputPopupOpen] = useState<boolean>(false);
    const [fileExtractedText, setFileExtractedText] = useState<string>(); //ToDo: to find a better way to handle this
    const [showDownloadCancelConfirmation, setShowDownloadCancelConfirmation] = useState<boolean>(false);
    const [isDownloadConfirmationOpen, setIsDownloadConfirmationOpen] = useState<boolean>(false);
    const { blobs, isTypeAACSupported, replay, partialChunkCompletedPlaying, showInfoToast, playTimeDuration, currentPlayTime, onScrub, handleVolumeChange, volume, onForward, onRewind, downloadPreviewText, progress, setProgress, downloadCombinedFile, isFetching, isPresenceModalOpen, setIsPresenceModalOpen, isBackPressed, setIsBackPressed, pause, play, extractText, splitAndSendPrompt, text, isPlaying, isLoading, reset, isPaused, playRate, handlePlayRateChange, voices, setVoices, hasCompletePlaying, setHasCompletePlaying, isVoiceLoading, reStartChunkProcess, chunks } = useAudioPlayer(isDownload);
    const { setOpen: setUpgradeModalOpen, isSubscribed, setReason, open: upgradeModalOpen } = usePremiumModal();
    const [timerPopupOpen, setTimerPopupOpen] = useState<boolean>(false);
    const [timerComplete, setTimerComplete] = useState<boolean>(false);
    const [timerLeft, setTimerLeft] = useState<number>(0);
    const [downloadDelay, setDownloadDelay] = useState<number>(0);
    const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);

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

    const resetter = (isBackPressed: boolean = false) => {
        reset(true, undefined, isBackPressed);
        setFiles([]);
        setPrompts([]);
        setTitle(undefined);
        resetDownloader();
        setPastedText(undefined);
        setFileExtractedText(undefined);
    }

    const onBackClick = async () => {
        if (isDownload && localStorage.getItem("gptr/download") === "true") return setShowDownloadCancelConfirmation(true);
        // delete the old ChatGPT conversation if we have one
        toast({ description: 'GPT Reader Alert: Clicking on the back button will trigger a refresh and the extension will be opened automatically afterwards. Make sure to confirm the above browser pop-up!', style: TOAST_STYLE_CONFIG_INFO });
        await new Promise(resolve => setTimeout(resolve, 400));
        localStorage.setItem("gptr/reloadDone", "true");
        window.location.href = window.location.href;
        //if is playing, wait for 500ms before resetting to avoid further chunk from being sent (May not work with 2g-3g networks)
        // if (isPlaying) {
        //     setTimeout(() => {
        //         resetter(true);
        //     }, 500)
        // } else {
        //     resetter(true);
        // }
        // setIsBackPressed(true);
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

    // free-user download delay: 1 s per 100 chars, min 5 s, max 60 s
    const startTimerOnce = useCallback(() => {
        if (timerIntervalRef.current) return;

        const charsPerSecond = 100;
        const maxDelay = 180; // seconds

        // sum characters in only as many chunks as we’ve fetched blobs for
        const totalChars = chunks
            .slice(0, blobs.length)
            .reduce((sum, chunk) => sum + chunk.text.length, 0);

        // compute raw secs (1 s/100 chars), then clamp between min and max delay
        const raw = Math.ceil(totalChars / charsPerSecond);
        const duration = Math.min(Math.max(raw, 30), maxDelay);
        setDownloadDelay(duration);
        setTimerLeft(duration);

        timerIntervalRef.current = setInterval(() => {
            setTimerLeft((prev) => {
                if (prev <= 1) {
                    clearInterval(timerIntervalRef.current!);
                    timerIntervalRef.current = null;
                    setTimerComplete(true);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
    }, [blobs, chunks]);

    const handleDownload = useCallback(() => {
      // Timer completed, proceed with download
      const fileName = title ?? "gpt-reader-audio.aac";
      downloadCombinedFile(fileName);
    }, [isSubscribed, timerComplete, title, blobs]);

    //handles the yes button click to resume the player
    const handleYes = useCallback(() => {
        reStartChunkProcess(true);
    }, [reStartChunkProcess]);

    //resets the player on click of presence confirmation popup no button
    const handleNo = useCallback(() => {
        resetter();
        onOverlayOpenChange(false);
    }, [onOverlayOpenChange, resetter]);

    const onDownloadCancel = useCallback(async () => {
        if (!isCancelDownloadConfirmation) {
            toast({ description: 'GPT Reader Alert: Clicking on the cancel button will trigger a refresh and the extension will be opened automatically afterwards. Make sure to confirm the above browser pop-up!', style: TOAST_STYLE_CONFIG_INFO });
            await new Promise(resolve => setTimeout(resolve, 400));
            localStorage.setItem("gptr/reloadDone", "true");
            window.location.href = window.location.href;
        } else {
            localStorage.setItem("gptr/reloadDone", "false");
            window.location.href = window.location.href;
        }
    }, [resetter, setShowDownloadCancelConfirmation])

    const onContinueDownload = useCallback((state: boolean) => {
        if (!state) setIsCancelDownloadConfirmation(state); //resetting the state if user clicks on no after triggering the confirmation by the close button
        setShowDownloadCancelConfirmation(state);
    }, [resetter])

    const onClosePremiumModal = (open: boolean) => {
      if (!open) {
        setUpgradeModalOpen(open);
        setShowDownloadOrListen(open);
        setInputPopupOpen(open);
      }
    };

    const triggerPremium = (
        e: React.MouseEvent<HTMLElement, MouseEvent>,
        customMessage?: string
    ) => {
        if (!isSubscribed) {
            setReason(
                customMessage ??
                "Free users do not have the ability to download while listening. This is a premium only feature, please subscribe to use it."
            );
            setUpgradeModalOpen(true);
            e.preventDefault();
        }
    };


    return (
        <>
            <DialogHeader className={cn("gpt:h-max", { "gpt:sr-only": isDownload })}>
                <DialogTitle className={"gpt:inline-flex gpt:flex-col gpt:justify-center gpt:items-center gpt:gap-2"}>
                    {title ?
                        <div className="gpt:inline-flex gpt:justify-center gpt:w-full gpt:items-center gpt:gap-3">
                            <p className="gpt:truncate gpt:max-w-[20dvw]">{title}</p>
                            <Popover onOpenChange={setIsDownloadConfirmationOpen} open={isDownloadConfirmationOpen}>
                                <PopoverTrigger asChild>
                                    <div onClick={e => triggerPremium(e)} className="gpt:relative gpt:size-10 gpt:hover:scale-115 gpt:active:scale-105 gpt:transition-all gpt:cursor-pointer">
                                        <Button
                                            disabled={!isPaused && !isPlaying}
                                            variant="ghost"
                                            size={"icon"}
                                            className="gpt:absolute gpt:top-1/2 gpt:start-1/2 gpt:transform gpt:-translate-y-1/2 gpt:-translate-x-1/2 gpt:rounded-full gpt:[&_svg]:size-6"
                                        >
                                            <DownloadCloud />
                                        </Button>
                                        <svg className="gpt:size-full gpt:-rotate-90" viewBox="0 0 36 36" xmlns="http://www.w3.org/2000/svg">
                                            <circle cx="18" cy="18" r="16" fill="none" className="gpt:transition-all gpt:ease-in-out gpt:stroke-current gpt:text-gray-800 dark:text-gray-100" strokeWidth="2"></circle>
                                            <circle cx="18" cy="18" r="16" fill="none" className="gpt:transition-all gpt:ease-in-out gpt:stroke-current gpt:text-gray-100 dark:text-gray-700" strokeWidth="2" strokeDasharray="100" strokeDashoffset={progress} strokeLinecap="square"></circle>
                                        </svg>
                                    </div>
                                    {/* <span className={cn("gpt:absolute gpt:transition-all gpt:left-0 gpt:bottom-0 gpt:bg-blue-800 gpt:w-full gpt:max-h-full", { "gpt:bg-green-600": progress === 100 })} style={{ height: `${progress}%` }}></span> */}
                                </PopoverTrigger>
                                <PopoverContent className="gpt:bg-gray-100 dark:bg-gray-800 gpt:border gpt:border-gray-200 dark:border-gray-700">
                                    <div className="gpt:flex gpt:flex-col gpt:gap-2">
                                        <p className="gpt:text-wrap">{chrome.i18n.getMessage("download_confirm")}</p>
                                        <div className="gpt:flex gpt:gap-4 gpt:w-full gpt:justify-center gpt:flex-wrap">
                                            <Button
                                                variant="ghost"
                                                className="gpt:flex-auto gpt:border gpt:border-gray-200 dark:border-gray-700 gpt:bg-gray-50 dark:bg-gray-800 gpt:[&_svg]:size-6 gpt:transition-all"
                                                onClick={() => { handleDownload(); setIsDownloadConfirmationOpen(false) }}
                                            >
                                                {chrome.i18n.getMessage("yes")}
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                className="gpt:flex-auto gpt:border gpt:border-gray-200 dark:border-gray-700 gpt:bg-gray-50 dark:bg-gray-800 gpt:[&_svg]:size-6 gpt:transition-all"
                                                onClick={() => setIsDownloadConfirmationOpen(false)}
                                            >
                                                {chrome.i18n.getMessage("no")}
                                            </Button>
                                        </div>
                                    </div>
                                </PopoverContent>
                            </Popover>
                        </div>
                        : <>{!prompts.length && <img src={logo} alt={chrome.i18n.getMessage("gpt_reader_logo")} className="gpt:size-10" />} {chrome.i18n.getMessage("gpt_reader")}</>}
                </DialogTitle>
                <DialogDescription className="gpt:sr-only">{chrome.i18n.getMessage("simplify_reading")}</DialogDescription>
            </DialogHeader>
            <div className="gpt:flex gpt:size-full gpt:flex-col gpt:justify-center gpt:gap-6 gpt:overflow-hidden" >
                <div className={cn("gpt:absolute gpt:top-4 gpt:left-4 gpt:size-max gpt:flex gpt:gap-2 gpt:items-center gpt:justify-center", { "gpt:translate-x-12 gpt:transition-transform": (prompts.length > 0 || isDownload) })}>
                    <ThemeToggle />
                    <FeedbackPopup />
                    <Announcements />
                </div>
                <div className={cn("gpt:absolute gpt:top-4 gpt:right-16 gpt:size-max")}>
                    <div className="gpt:flex gpt:gap-2 gpt:items-center">
                        <Button variant="ghost" onClick={() => chrome.runtime.sendMessage({ type: "OPEN_FAQ_VIDEO" })} className="gpt:rounded-full gpt:border gpt:border-gray-200 dark:border-gray-700 gpt:bg-gray-50 dark:bg-gray-800 gpt:[&_svg]:size-6 gpt:transition-all">
                            <HelpCircleIcon /> {chrome.i18n.getMessage("having_issues")}
                        </Button>
                        {!isSubscribed && (
                            <Button
                                variant="ghost"
                                onClick={e => triggerPremium(e, "Consider upgrading your membership to enjoy premium features now!")}
                                className="gpt:rounded-full gpt:border gpt:border-gray-200 dark:border-gray-700 gpt:bg-gray-50 dark:bg-gray-800 gpt:[&_svg]:size-6 gpt:transition-all"
                                aria-haspopup="dialog"
                                >
                                <Crown /> Upgrade Membership
                            </Button>
                        )}
                        <CancelPremiumPopup isSubscribed={isSubscribed} />
                    </div>
                </div>

                <PresenceConfirmationPopup loading={false} handleYes={handleYes} handleNo={handleNo} open={isPresenceModalOpen} setOpen={setIsPresenceModalOpen} />
                <DownloadOrListen onSubmit={onDownloadOrListenSubmit} open={showDownloadOrListen} onOpenChange={(state) => {
                    if (!state) resetter()
                    setShowDownloadOrListen(state);
                }} />

                {(prompts.length === 0 && !isDownload) ? <VoiceSelector voice={voices} setVoices={setVoices} disabled={isVoiceLoading} loading={isVoiceLoading} /> : null}

                {(prompts.length > 0 || isDownload) && <Button title={chrome.i18n.getMessage("back")} size={"icon"} onClick={onBackClick} className="gpt:hover:scale-115 gpt:active:scale-105 gpt:transition-all gpt:font-medium gpt:absolute gpt:top-4 gpt:left-4 gpt:rounded-full gpt:border gpt:border-gray-200 dark:border-gray-700 gpt:bg-gray-50 dark:bg-gray-800 gpt:[&_svg]:size-6"><ArrowLeft /><span className="gpt:sr-only">{chrome.i18n.getMessage("back")}</span></Button>}

                {
                    (prompts.length > 0 || isDownload) ?
                        <Previews setDownloadCancelConfirmation={onContinueDownload} downloadCancelConfirmation={showDownloadCancelConfirmation} downloadPreviewText={downloadPreviewText} onDownload={handleDownload} onDownloadCancel={onDownloadCancel} file={files[0]} content={text} isDowloading={isDownload} progress={progress} />
                        : <FileUploader
                            value={files}
                            disabled={isPlaying || isFetching}
                            accept={BROWSER === "firefox" ? ACCEPTED_FILE_TYPES_FIREFOX : ACCEPTED_FILE_TYPES}
                            maxFileCount={MAX_FILES}
                            onValueChange={onSave}
                        />
                }

                {/* <Player currentTime={currentPlayTime} duration={playTimeDuration} handleVolumeChange={handleVolumeChange} volume={volume} onForward={onForward} onRewind={onRewind} isFirstChunk={isLoading} showControls={prompts.length > 0} hasPlayBackEnded={hasCompletePlaying} setHasPlayBackEnded={setHasCompletePlaying} isPaused={isPaused} isPlaying={isPlaying} isLoading={isLoading || isStreamLoading} play={play} pause={pause} handlePlayRateChange={handlePlayRateChange} playRate={playRate} /> */}
                <PlayerBackup areSeekControlsAvailable={isTypeAACSupported} replay={replay} partialChunkCompletedPlaying={partialChunkCompletedPlaying} setPlaybackEnded={setHasCompletePlaying} showControls={prompts.length > 0} playRate={playRate} handlePlayRateChange={handlePlayRateChange} playbackEnded={hasCompletePlaying} isPaused={isPaused} isLoading={isLoading || isFetching} volume={volume} handleVolumeChange={handleVolumeChange} onScrub={onScrub} play={play} pause={pause} currentTime={currentPlayTime} duration={playTimeDuration} isPlaying={isPlaying} onForward={onForward} onRewind={onRewind} />

                {
                    (!prompts?.length && !isDownload) ?
                        <InputPopup open={inputPopupOpen} onOpenChange={setInputPopupOpen} disabled={isPlaying || isFetching} onSubmit={onFormSubmit} />
                        : null
                }
                {prompts.length > 0 && !isDownload && <InfoIcon onClick={() => showInfoToast(5000)} className={cn("gpt:z-[51] gpt:hover:cursor-pointer gpt:absolute gpt:bottom-4 gpt:right-4 gpt:rounded-full gpt:hover:scale-115 gpt:active:scale-105 gpt:transition-all gpt:size-6")} />}

                {!isSubscribed && timerPopupOpen && (
                    <TimerPopup
                        open={timerPopupOpen}
                        onClose={() => setTimerPopupOpen(false)}
                        timeLeft={timerLeft}
                    />
                )}
                
                {/* Premium Modal  */}
                {upgradeModalOpen && <PremiumModal open={upgradeModalOpen} onOpenChange={onClosePremiumModal} />}
            </div>
        </>

    )
}

export default memo(Content, (p, n) => p.isCancelDownloadConfirmation === n.isCancelDownloadConfirmation && p.prompts === n.prompts);