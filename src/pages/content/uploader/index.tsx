import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTrigger
} from "@/components/ui/dialog";
import { Toaster } from "@/components/ui/toaster";
import useAuthToken from "@/hooks/use-auth-token";
import { useToast } from "@/hooks/use-toast";
import { LISTENERS, MODELS_TO_WARN, PROMPT_INPUT_ID, TOAST_STYLE_CONFIG } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { useEffect, useMemo, useRef, useState } from "react";
import AlertPopup from "./alert-popup";
import Content from "./content";
export interface PromptProps {
  text: string | undefined
}

function Uploader() {
  const waitForElement = (selector: string, timeout = 5000): Promise<Element> => {
    return new Promise((resolve, reject) => {
      const el = document.querySelector(selector);
      if (el) return resolve(el);
      const observer = new MutationObserver(() => {
        const elFound = document.querySelector(selector);
        if (elFound) {
          observer.disconnect();
          resolve(elFound);
        }
      });
      observer.observe(document.body, { childList: true, subtree: true });
      setTimeout(() => {
        observer.disconnect();
        reject(new Error(`Timeout: Element ${selector} not found.`));
      }, timeout);
    });
  };

  const [prompts, setPrompts] = useState<PromptProps[]>([]);
  const [isActive, setIsActive] = useState<boolean>(false);
  const activateButton = useRef<HTMLButtonElement>(null);
  // const [openTries, setOpenTries] = useState<number>(0);
  const [minimised, setMinimised] = useState<boolean>(true);
  const [confirmed, setConfirmed] = useState<boolean>(false);
  const [overActiveInterval, setOverlayAciveInterval] = useState<NodeJS.Timeout | null>(null);
  const [isOverlayFallback, setIsOverlayFallback] = useState<boolean>(true);
  const [isCancelDownloadConfirmation, setIsCancelDownloadConfirmation] = useState<boolean>(false);
  const [isOffline, setIsOffline] = useState<boolean>(false);

  const { toast } = useToast();
  const { isAuthenticated } = useAuthToken();
  const LOGO = chrome.runtime.getURL('logo-128.png');

  // sending the auth status to the background script
  useMemo(() => {
    chrome.runtime.sendMessage({ isAuthenticated: isAuthenticated, type: LISTENERS.AUTH_RECEIVED });
  }, [isAuthenticated]);

  //removes draft conversations from local storage on page unload (prevents causing content not loaded error)
  useEffect(() => {
    const handleUnload = (event: BeforeUnloadEvent) => {
      localStorage.removeItem("oai/apps/conversationDrafts");
      event.preventDefault();
    };
    window.addEventListener("beforeunload", handleUnload);
    return () => {
      window.removeEventListener("beforeunload", handleUnload);
    };
  }, []);


  useEffect(() => {
    if (!document.getElementById("gpt-reader-injected")) {
      const s = document.createElement('script');
      s.id = "gpt-reader-injected";
      s.src = chrome.runtime.getURL('injected.js');
      (document.head || document.documentElement).appendChild(s);

      chrome.runtime.onMessage.addListener((message) => {
        if (message.type === "OPEN_POPUP") {

          //if origin is not verified, verify it
          if (message.payload === "VERIFY_ORIGIN") {
            chrome.runtime.sendMessage({ type: "VERIFY_ORIGIN" });
            return
          }

          //if origin is verified, open the overlay
          if (message.payload === "ORIGIN_VERIFIED") {
            const active = window.localStorage.getItem("gptr/active");
            //if overlay is set to closed, open the overlay
            if (active && active !== "true") {
              activateButton.current?.click();
            }
          }
        }
      })

    }

    chrome.runtime.sendMessage({ type: "CONTENT_LOADED" }); //indicate to background script that content is loaded

    //checking if user has already confirmed the extension
    const cnf = window.localStorage.getItem("gptr/confirmation");
    setConfirmed(cnf === "true");
  }, []);

  //toddo: refactor as this might exceed space
  useEffect(() => {
    const interval = setInterval(() => {
      const active = window.localStorage.getItem("gptr/active");
      if (active && active === "true") {
        setIsOverlayFallback(true);
      }
    }, 500);
    setOverlayAciveInterval(interval);
    return () => {
      if (overActiveInterval) clearInterval(overActiveInterval);
    }
  }, [])

  useEffect(() => {
    //if redirection to login page is set and user is authenticated, open the overlay after 1s
    const isRedirectToLogin = window.localStorage.getItem("gptr/redirect-to-login");
    if (isRedirectToLogin && isRedirectToLogin === "true" && isAuthenticated) {
      //console.log("redirecting to login");
      chrome.runtime.sendMessage({ type: "CONTENT_LOADED" }); //indicate to background script that content is loaded
    }
  }, [isAuthenticated, isActive]);

  //check if the send button is present on the dom
  const isSendButtonPresentOnDom = () => {
    const sendButton: HTMLButtonElement | null = document.querySelector("[data-testid='send-button']");
    return sendButton !== null;
  }

  //check if the speech button is present on the dom
  // const isComposerSpeechButtonPresentOnDom = () => {
  //   const speechButton: HTMLDivElement | null = document.querySelector("[data-testid='composer-speech-button']");
  //   return speechButton !== null;
  // }

  const clickStopButtonIfPresent = async (): Promise<void> => {
    const stopButton = document.querySelector("[data-testid='stop-button']") as HTMLDivElement | null;
    if (stopButton) {
      stopButton.click();
      try {
        await waitForElement("[data-testid='composer-speech-button']", 1500);
      } catch (error) {
        console.log(error);
      }
    }
  };

  //add speech found text to the input and open the popup
  const addTextToInputAndOpen = (text: string) => {
    const textarea = document.querySelector(PROMPT_INPUT_ID) as HTMLTextAreaElement;
    if (textarea) {
      textarea.innerHTML = `<p>${text}</p>`;
      textarea.focus();
    } else {
      console.log('Having trouble finding the textarea');
    }
  }

  const isBadModel = () => {
    const isSupportedModel = (models: string | string[]) => MODELS_TO_WARN.some((model) => models.includes(model));
    //checking if the user has a last used model stored in local storage
    // if (userId) {
    //   const lastUsedModelKey = findMatchLocalStorageKey(userId);
    //   if (lastUsedModelKey) {
    //     const lastUsedModel = localStorage.getItem(lastUsedModelKey);
    //     if (lastUsedModel) {
    //       return isSupportedModel(lastUsedModel);
    //     }
    //   }
    // }
    // if the user has not used a model before, check if the model switcher is present on the dom
    const modelSwitcher = document.querySelector('[data-testid="model-switcher-dropdown-button"]') as HTMLButtonElement;
    if (modelSwitcher) {
      return isSupportedModel(modelSwitcher.innerHTML);
    }
    return false
  };

  const onOpenChange = async (open: boolean) => {
    if (!open) {
      //show confirmation for cancel download if download is in progress
      const download = window.localStorage.getItem("gptr/download");
      if (download && download === "true") {
        setIsCancelDownloadConfirmation(true);
        return
      }
      setIsActive(false);
      return
    }
    const aoc = window.localStorage.getItem("gptr/aoc");
    //return if overlay is already active.
    if (open && aoc && +aoc > 0) {
      setIsOverlayFallback(true);
      return;
    }
    //redirect to login if click on button if not authorised
    if (!isAuthenticated) {
      const loginBtn: HTMLButtonElement | null = document.querySelector("[data-testid='login-button']");
      if (loginBtn) {
        window.localStorage.setItem("gptr/redirect-to-login", "true");
        chrome.runtime.sendMessage({ type: "SET_ORIGIN" }); //indicate to background script that open is triggered from the reader button
        loginBtn?.click();
      } else {
        //send message to background to try again if user is not authorised and login btn not present
        chrome.runtime.sendMessage({ type: "NO_AUTH_TRY_AGAIN" });
      }
      return;
    }

    window.localStorage.removeItem("gptr/redirect-to-login");

    await clickStopButtonIfPresent();

    //gpt has a new update, shows speech button by default instead of the send button until the user types in text
    addTextToInputAndOpen(chrome.i18n.getMessage("gpt_reader"));

    // If the send button is missing, wait until it appears
    if (!isSendButtonPresentOnDom()) {
      try {
        await waitForElement("[data-testid='send-button']", 5000);
      } catch (error) {
        setIsActive(false);
        toast({
          description: chrome.i18n.getMessage("chat_error"),
          style: TOAST_STYLE_CONFIG,
        });
        return;
      }
    }
    // to avoid the content not loaded issue
    addTextToInputAndOpen("");
    //check if the user has selected a slow model
    if (isBadModel()) {
      toast({ description: "GPT Reader advises you to select the GPT-4 based models for best results. The current chosen model maybe too slow.", duration: 5000, style: TOAST_STYLE_CONFIG });
    }
    setIsActive(true);
  };

  const handleConfirm = (state: boolean) => {
    if (!state) return onOpenChange(false);
    window.localStorage.setItem("gptr/confirmation", String(state));
    setConfirmed(state)
  }

  useMemo(() => {
    // chrome.runtime.sendMessage({ type: "UPDATE_BADGE_STATE", state: isActive });
    window.localStorage.setItem("gptr/active", String(isActive)); //set overlay state to storage
    if (isActive) {
      //set active overlay count
      const aoc = window.localStorage.getItem("gptr/aoc");
      const count = aoc ? +aoc : 0;
      window.localStorage.setItem("gptr/aoc", String(count + 1));

      //clear the origins (onClick and onInstall once overlay is opened)
      chrome.runtime.sendMessage({ type: "CLEAR_ORIGIN" });
    } else {
      //reset active overlay count
      window.localStorage.setItem("gptr/aoc", "0");
    }
  }, [isActive])


  //check for network connection via navigator
  const updateConnectionStatus = () => {
    setIsOffline(!navigator.onLine);
    if (!navigator.onLine) {
      toast({ description: chrome.i18n.getMessage("offline_warning"), style: TOAST_STYLE_CONFIG });
    }
  }

  useEffect(() => {
    // audioPlayer.addEventListener(LISTENERS.AUDIO_ENDED, handleAudioEnd);
    window.addEventListener('online', updateConnectionStatus);
    window.addEventListener('offline', updateConnectionStatus);
    return () => {
      // audioPlayer.removeEventListener(LISTENERS.AUDIO_ENDED, handleAudioEnd);
      window.removeEventListener('online', updateConnectionStatus);
      window.removeEventListener('offline', updateConnectionStatus);
    }
  }, []);

  return (
    <>
      <Dialog open={isActive} onOpenChange={onOpenChange}>
        <DialogTrigger asChild>
          <Button
            disabled={isOffline}
            ref={activateButton}
            variant="outline"
            size="lg"
            onMouseOver={() => setMinimised(false)}
            onMouseOut={() => setMinimised(true)}
            className={cn("shadow-md absolute flex justify-center items-center z-[101] top-60 right-0 rounded-l-full! bg-gray-100! dark:bg-gray-900! p-2 border border-r-0 border-gray-200! dark:border-gray-700! transition-all",
              {
                "!z-[50]": isActive || isOverlayFallback,
              })
            }
          >
            <img src={LOGO} alt="GPT Reader Logo" className="size-6" />{!minimised && (
              <> {!isAuthenticated && chrome.i18n.getMessage("login_to_use")} {isAuthenticated && chrome.i18n.getMessage("activate")} GPT Reader</>
            )}
          </Button>
        </DialogTrigger>
        <DialogContent
          onInteractOutside={(e: Event) => {
            e.preventDefault(); //prevents mask click close
          }}
          className={cn("bg-gray-100 dark:bg-gray-800 max-w-screen h-full border-none flex flex-col gap-4", prompts?.length && "pb-0")}
        >
          {!confirmed && <AlertPopup setConfirmed={handleConfirm} />}
          {confirmed && <Content isCancelDownloadConfirmation={isCancelDownloadConfirmation} setIsCancelDownloadConfirmation={setIsCancelDownloadConfirmation} onOverlayOpenChange={onOpenChange} setPrompts={setPrompts} prompts={prompts} />}
        </DialogContent>
      </Dialog>
      <Toaster />
    </>
  );
}

export default Uploader;
