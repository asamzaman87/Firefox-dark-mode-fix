
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
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { InputFormProps } from "./input-popup/input-form";
import InputPopup from "./input-popup/popup";
import Player from "./player-button";
import Previews from "./previews";
import VoiceSelector from "./voice-selector";
import useMouseMove from "@/hooks/use-mouse-move";

export interface PromptProps {
  text: string | undefined
}

function Uploader() {
  const [prompts, setPrompts] = useState<PromptProps[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [isActive, setIsActive] = useState<boolean>(false);
  const activateButton = useRef<HTMLButtonElement>(null);

  const { hide, handleMouseMove } = useMouseMove();
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

  const onClose = (open: boolean) => {
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
      <Dialog open={isActive} onOpenChange={onClose}>
        <DialogTrigger asChild>
          <Button
            ref={activateButton}
            disabled={!isAuthenticated}
            variant="outline"
            size="lg"
            className="shadow-md absolute flex justify-center items-center z-50 top-60 right-0 rounded-l-full bg-white dark:bg-gray-900 p-2 border border-r-0 border-gray-200 dark:border-gray-700"
          >
            <img src={logo} alt="GPT Reader Logo" className="size-6" /> Activate GPT Reader
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
          <div className="group flex size-full flex-col justify-center gap-6 overflow-hidden"  onMouseMove={handleMouseMove}>

            {prompts.length === 0 ? <VoiceSelector disabled={isLoading || isPlaying} voice={voices} setVoices={setVoices} /> : null}

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
              <div className={cn("transition-opacity", { "opacity-0": hide })}>
                <Player isPaused={isPaused} isPlaying={isPlaying} isLoading={isLoading} play={play} pause={pause} handlePlayRateChange={handlePlayRateChange} playRate={playRate} />
              </div>
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
