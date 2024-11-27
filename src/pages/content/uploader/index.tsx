
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTrigger
} from "@/components/ui/dialog";
import { Toaster } from "@/components/ui/sonner";
import useAuthToken from "@/hooks/use-auth-token";
import { LISTENERS, TOAST_STYLE_CONFIG } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import Content from "./content";
export interface PromptProps {
  text: string | undefined
}

function Uploader() {
  const [prompts, setPrompts] = useState<PromptProps[]>([]);
  const [isActive, setIsActive] = useState<boolean>(false);
  const activateButton = useRef<HTMLButtonElement>(null);
  const [openTries, setOpenTries] = useState<number>(0);

  const { isAuthenticated } = useAuthToken();

  useMemo(() => {
    chrome.runtime.sendMessage({ isAuthenticated: isAuthenticated, type: LISTENERS.AUTH_RECEIVED });
  }, [isAuthenticated]);

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

  useEffect(() => {
    const s = document.createElement('script');
    s.src = chrome.runtime.getURL('injected.js');
    (document.head || document.documentElement).appendChild(s);
  }, []);

  //check if the send button is present on the dom
  const isSendButtonPresentOnDom = () => {
    const sendButton: HTMLButtonElement | null = document.querySelector("[data-testid='send-button']");
    return sendButton !== null;
  }


  const onOpenChange = (open: boolean) => {
    //redirect to login if click on button if not authorised
    if (!isAuthenticated) {
      const loginBtn: HTMLButtonElement | null = document.querySelector("[data-testid='login-button']");
      if (loginBtn) {
        loginBtn?.click();
      }
      return;
    }
    //if the send button is not present on the dom show error message
    if (!isSendButtonPresentOnDom()) {
      setIsActive(false);
      setOpenTries(tries => tries + 1);
      if (openTries > 3) {
        toast.error("There is an on-going conversation or you have exceeded the hourly limit. Please wait try again later!", { duration: 10000, dismissible: true, style: TOAST_STYLE_CONFIG });
        setOpenTries(0);
      }
      return;
    }
    setIsActive(open);
  }
  const logo = chrome.runtime.getURL('logo-128.png');

  return (
    <div>
      <Dialog open={isActive} onOpenChange={onOpenChange}>
        <DialogTrigger asChild>
          <Button
            ref={activateButton}
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

          <Content setPrompts={setPrompts} prompts={prompts}/>

        </DialogContent>
      </Dialog>
      <Toaster />
    </div>
  );
}

export default Uploader;
