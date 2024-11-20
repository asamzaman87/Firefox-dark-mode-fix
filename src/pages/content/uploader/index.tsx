
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from "@/components/ui/dialog";
import { FileUploader } from "@/components/ui/file-uploader";
import { Toaster } from "@/components/ui/sonner";
import useAudioPlayerNew from "@/hooks/use-audio-player";
import { ACCEPTED_FILE_TYPES, MAX_FILES, MAX_FILE_SIZE, TOAST_STYLE_CONFIG } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { ArrowLeft } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { InputFormProps } from "./input-popup/input-form";
import InputPopup from "./input-popup/popup";
import Player from "./player-button";
import Previews from "./previews";
import VoiceSelector from "./voice-selector";
export interface PromptProps {
  text: string | undefined
}

function Uploader() {
  const [prompts, setPrompts] = useState<PromptProps[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [isActive, setIsActive] = useState<boolean>(false);
  const activateButton = useRef<HTMLButtonElement>(null);
  const [openTries, setOpenTries] = useState<number>(0);

  const { pause, play, extractText, splitAndSendPrompt, text, isPlaying, isLoading, reset, isAuthenticated, isPaused, playRate, handlePlayRateChange, voices, setVoices } = useAudioPlayerNew();

  chrome.runtime.onConnect.addListener((port) => {
    port.onMessage.addListener((msg) => {
      if (port.name === "activate") {
        if (msg.message === "ACTIVATE") {
          port.postMessage({ message: true, type: "STATUS" });
          activateButton.current?.click();
        }

        if (msg.message === "STATUS") {
          const rootContainer = document.querySelector('#__gpt-reader-shadow');
          if (!rootContainer) { chrome.runtime.sendMessage({ message: "REINJECT" }) }
          port.postMessage({ message: isActive, type: "STATUS" });
        }
      }
    });
  });

  useMemo(() => {
    if (text?.trim()?.length) {
      setPrompts([{ text }])
    } else {
      setPrompts([])
    }
  }, [text])


  const onFormSubmit: InputFormProps["onSubmit"] = (values) => {
    splitAndSendPrompt(values.text)
  }

  useEffect(() => {
    const s = document.createElement('script');
    s.src = chrome.runtime.getURL('injected.js');
    (document.head || document.documentElement).appendChild(s);
  }, []);

  const onSave = (files: File[]) => {
    if (!files?.length) return toast.error("No files selected!", { style: TOAST_STYLE_CONFIG });
    setFile(files[0]);
    extractText(files[0])
  }

  //check if the send button is present on the dom
  const isSendButtonPresentOnDom = () => {
      const sendButton: HTMLButtonElement | null = document.querySelector("[data-testid='send-button']");
      return sendButton !== null;
  }

  //todo: check reset bug audio not properly resetting
  const onBackClick = () => {
    reset(true);
    setFile(null);
    setPrompts([]);
  }

  const onOpenChange = (open: boolean) => {
    //if the send button is not present on the dom show error message
    if (!isSendButtonPresentOnDom()) {
      setIsActive(false);
      setOpenTries(tries => tries + 1);
      if (openTries > 3) {
        toast.error("There is an on-going conversation or you have exceeded the hourly limit. Please wait try again later!", {duration: 10000, dismissible: true, style: TOAST_STYLE_CONFIG });
        setOpenTries(0);
      }
      return;
    }
    setIsActive(open);
    if (!open) {
      reset(true);
      setFile(null);
      setPrompts([]);
    }
  }
  const logo = chrome.runtime.getURL('logo-128.png');

  return (
    <div>
      <Dialog open={isActive} onOpenChange={onOpenChange}>
        <DialogTrigger asChild>
            <Button
              ref={activateButton}
              disabled={!isAuthenticated}
              variant="outline"
              size="lg"
              className="shadow-md absolute flex justify-center items-center z-50 top-60 right-0 rounded-l-full bg-white dark:bg-gray-900 p-2 border border-r-0 border-gray-200 dark:border-gray-700"
            >
              <img src={logo} alt="GPT Reader Logo" className="size-6" /> {!isAuthenticated && "Login to use"} {isAuthenticated && "Activate"} GPT Reader
            </Button>
        </DialogTrigger>
        <DialogContent
          onInteractOutside={(e: Event) => {
            e.preventDefault(); //prevents mask click close
          }}
          className={cn("bg-gray-100 dark:bg-gray-800 max-w-screen h-full border-none flex flex-col gap-6", prompts?.length && "pb-0")}
        >
          <DialogHeader className={cn("h-max", prompts?.length && "sr-only")}>
            <DialogTitle className="inline-flex flex-col justify-center items-center gap-2"><img src={logo} alt="GPT Reader Logo" className="size-10" />GPT Reader</DialogTitle>
            <DialogDescription className="sr-only">Simplify reading long documents with GPT</DialogDescription>
          </DialogHeader>
          <div className="group flex size-full flex-col justify-center gap-6 overflow-hidden">

            {prompts.length === 0 ? <VoiceSelector disabled={isPlaying} voice={voices} setVoices={setVoices} /> : null}

            {prompts.length > 0 && <Button onClick={onBackClick} variant="ghost" className="font-medium size-max absolute top-4 left-4 rounded-full border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800"><ArrowLeft /> <span className="sr-only">Back</span>Back</Button>}

            {prompts.length > 0 ?
              <Previews file={file} content={text} />
              : <FileUploader
                disabled={isPlaying}
                accept={ACCEPTED_FILE_TYPES}
                maxFileCount={MAX_FILES}
                maxSize={MAX_FILE_SIZE}
                onValueChange={onSave}
              />}

            {prompts.length > 0 ?
                <Player isPaused={isPaused} isPlaying={isPlaying} isLoading={isLoading} play={play} pause={pause} handlePlayRateChange={handlePlayRateChange} playRate={playRate} />
              : null}

            {!prompts?.length ?
              <InputPopup disabled={isPlaying} onSubmit={onFormSubmit} />
              : null
            }
          </div>
        </DialogContent>
      </Dialog>
      <Toaster />
    </div>
  );
}

export default Uploader;
