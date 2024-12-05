
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTrigger
} from "@/components/ui/dialog";
import { Toaster } from "@/components/ui/toaster";
import useAuthToken from "@/hooks/use-auth-token";
import { useToast } from "@/hooks/use-toast";
import { LISTENERS, PROMPT_INPUT_ID, TOAST_STYLE_CONFIG } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { useEffect, useMemo, useRef, useState } from "react";
import AlertPopup from "./alert-popup";
import Content from "./content";
export interface PromptProps {
  text: string | undefined
}

function Uploader() {
  const [prompts, setPrompts] = useState<PromptProps[]>([]);
  const [isActive, setIsActive] = useState<boolean>(false);
  const activateButton = useRef<HTMLButtonElement>(null);
  const [openTries, setOpenTries] = useState<number>(0);
  const [minimised, setMinimised] = useState<boolean>(false);
  const [confirmed, setConfirmed] = useState<boolean>(false);

  const { toast } = useToast();
  const { isAuthenticated } = useAuthToken();
  const LOGO = chrome.runtime.getURL('logo-128.png');

  //sending the auth status to the background script
  useMemo(() => {
    chrome.runtime.sendMessage({ isAuthenticated: isAuthenticated, type: LISTENERS.AUTH_RECEIVED });
  }, [isAuthenticated]);

  //listening for messages from the background script/popup
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

  useEffect(() => {
    chrome.runtime.onMessage.addListener((message) => {
      if (message.type === "OPEN_POPUP") {
        if(!isAuthenticated){
          window.localStorage.setItem("gptr/redirect-to-login", "true"); // if logged out, redirect to login page and set local storage to true to know its redirected from extension action
        }
        activateButton.current?.click();
      }
    })
    //if redirection to login page is set and user is authenticated, open the overlay after 1s
    const isRedirectToLogin = window.localStorage.getItem("gptr/redirect-to-login");
    if(isRedirectToLogin && isAuthenticated){
      window.localStorage.removeItem("gptr/redirect-to-login");
      setTimeout(()=>activateButton.current?.click(), 1000); 
    }
  }, [isAuthenticated]);

  //check if the send button is present on the dom
  const isSendButtonPresentOnDom = () => {
    const sendButton: HTMLButtonElement | null = document.querySelector("[data-testid='send-button']");
    return sendButton !== null;
  }

  //check if the speech button is present on the dom
  const isComposerSpeechButtonPresentOnDom = () => {
    const speechButton: HTMLDivElement | null = document.querySelector("[data-testid='composer-speech-button']");
    return speechButton !== null;
  }

  //add speech found text to the input and open the popup
  const addTextToInputAndOpen = (text: string) => {
    const textarea = document.querySelector(PROMPT_INPUT_ID) as HTMLTextAreaElement;
    if (textarea) {
      textarea.innerHTML = `<p>${text}</p>`;
      textarea.focus();
      return setTimeout(()=>setIsActive(true), 500);
    }
    return toast({ description:"There is an on-going conversation or you have exceeded the hourly limit. Please wait try again later!", style: TOAST_STYLE_CONFIG });
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
    if (!isSendButtonPresentOnDom() && open) {

      //gpt has a new update, shows speech button by default instead of the send button until the user types in text
      if (isComposerSpeechButtonPresentOnDom()) {
        //if the speech button is present on the dom, add speech found text to the input and open the popup
        addTextToInputAndOpen("Speech Found"); 
      }

      setIsActive(false);
      setOpenTries(tries => tries + 1);
      if (openTries > 3) {
        toast({ description:"There is an on-going conversation or you have exceeded the hourly limit. Please wait try again later!", style: TOAST_STYLE_CONFIG });
        setOpenTries(0);
      }
      return;
    }
    
    setIsActive(open);

    if(window) {
      const cnf = window.localStorage.getItem("gptr/confirmation");
      setConfirmed(cnf==="true");
    }
  }

  const handleConfirm = (state: boolean) => {
    if(!state) return onOpenChange(false);
    window.localStorage.setItem("gptr/confirmation", String(state));
    setConfirmed(state)
  }

  useMemo(()=>{
    chrome.runtime.sendMessage({ type: "UPDATE_BADGE_STATE", state: isActive });
  },[isActive])

  return (
    <div>
      <Dialog open={isActive} onOpenChange={onOpenChange}>
        <DialogTrigger asChild>
          <Button
            ref={activateButton}
            variant="outline"
            size="lg"
            onMouseOver={() => setMinimised(false)}
            onMouseOut={() => setMinimised(true)}
            className={cn("shadow-md absolute flex justify-center items-center z-[101] top-60 right-0 rounded-l-full bg-white dark:bg-gray-900 p-2 border border-r-0 border-gray-200 dark:border-gray-700 transition-all", {"translate-x-36": minimised && isAuthenticated, "!z-[50]" : isActive, "translate-x-44": !isAuthenticated && minimised })}
            >
            <img src={LOGO} alt="GPT Reader Logo" className="size-6" /> {!isAuthenticated && "Login to use"} {isAuthenticated && "Activate"} GPT Reader
          </Button>
        </DialogTrigger>
        <DialogContent
          onInteractOutside={(e: Event) => {
            e.preventDefault(); //prevents mask click close
          }}
          className={cn("bg-gray-100 dark:bg-gray-800 max-w-screen h-full border-none flex flex-col gap-6", prompts?.length && "pb-0")}
        >
          {!confirmed && <AlertPopup setConfirmed={handleConfirm} />}
          {confirmed && <Content setPrompts={setPrompts} prompts={prompts}/>}
        </DialogContent>
      </Dialog>
      <Toaster />
    </div>
  );
}

export default Uploader;
