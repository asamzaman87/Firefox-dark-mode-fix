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
import { cn, deleteChatAndCreateNew } from "@/lib/utils";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import AlertPopup from "./alert-popup";
import Content from "./content";
import PinTutorialPopUp from "./pin-tutorial-popup";
export interface PromptProps {
  text: string | undefined
}

function Uploader() {
  const waitForElement = (
    selector: string | string[],
    timeout = 5000
  ): Promise<Element> => {
    const combinedSelector = Array.isArray(selector) ? selector.join(", ") : selector;
  
    return new Promise((resolve, reject) => {
      const el = document.querySelector(combinedSelector);
      if (el) return resolve(el);
  
      const observer = new MutationObserver(() => {
        const elFound = document.querySelector(combinedSelector);
        if (elFound) {
          observer.disconnect();
          resolve(elFound);
        }
      });
  
      observer.observe(document.body, { childList: true, subtree: true });
  
      setTimeout(() => {
        observer.disconnect();
        reject(new Error(`Timeout: Element ${combinedSelector} not found.`));
      }, timeout);
    });
  };
  

  const [prompts, setPrompts] = useState<PromptProps[]>([]);
  const [isActive, setIsActive] = useState<boolean>(false);
  const activateButton = useRef<HTMLButtonElement>(null);
  // const [openTries, setOpenTries] = useState<number>(0);
  const [minimised, setMinimised] = useState<boolean>(true);
  const [confirmed, setConfirmed] = useState<boolean>(false);
  const [showPinTutorial, setShowPinTutorial] = useState<boolean>(false);
  const [overActiveInterval, setOverlayAciveInterval] = useState<NodeJS.Timeout | null>(null);
  const [isOverlayFallback, setIsOverlayFallback] = useState<boolean>(true);
  const [isCancelDownloadConfirmation, setIsCancelDownloadConfirmation] = useState<boolean>(false);
  const [isOffline, setIsOffline] = useState<boolean>(false);

  const { toast } = useToast();
  const { isAuthenticated } = useAuthToken();
  const wasActive = useRef<boolean>(false);
  const isOpening = useRef<boolean>(false);
  const LOGO = chrome.runtime.getURL('logo-128.png');

  // sending the auth status to the background script
  useMemo(() => {
    chrome.runtime.sendMessage({ isAuthenticated: isAuthenticated, type: LISTENERS.AUTH_RECEIVED });
  }, [isAuthenticated]);

 // ─── ALWAYS hide any ChatGPT “conversation-fetch-error-toast” ───
 useEffect(() => {

  const HIDE_SELECTOR = "[data-testid*='conversation-fetch-error']";

  // Helper: given any node that just got inserted, see if it (or its children)
  // matches our “fetch-error” selector—then hide/remove its closest “.toast-root”.
  const hideErrorToast = (node: Element) => {
    if (!(node instanceof HTMLElement)) return;

    // 1) If this node itself has data-testid containing "conversation-fetch-error"…
    if (node.matches(HIDE_SELECTOR)) {
      const toastRoot = node.closest(".toast-root") as HTMLElement | null;
      if (toastRoot) {
        toastRoot.style.display = "none";
      } else {
        // fallback: just hide the node directly
        node.style.display = "none";
      }
      return;
    }

    // 2) Otherwise, if any child inside this node matches our selector…
    const child = node.querySelector(HIDE_SELECTOR) as HTMLElement | null;
    if (child) {
      const toastRoot = child.closest(".toast-root") as HTMLElement | null;
      if (toastRoot) {
        toastRoot.style.display = "none";
      } else {
        child.style.display = "none";
      }
    }
  };

  // Set up a MutationObserver on <body> to catch all future insertions
  const observer = new MutationObserver((mutations) => {
    for (const m of mutations) {
      for (const addedNode of Array.from(m.addedNodes)) {
        hideErrorToast(addedNode as Element);
      }
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });

  // Do an initial pass (in case the toast is already on screen right now)
  document.querySelectorAll(HIDE_SELECTOR).forEach((el) => {
    const node = el as HTMLElement;
    const toastRoot = node.closest(".toast-root") as HTMLElement | null;
    if (toastRoot) {
      toastRoot.style.display = "none";
    } else {
      node.style.display = "none";
    }
  });

  // Cleanup on unmount
  return () => {
    observer.disconnect();
  };
  }, []);

  // unload chat deletion
  useEffect(() => {
    if (!isAuthenticated) return;
    if (isActive) {
      wasActive.current = true;
    }
    if (!isActive && wasActive.current) {
      (async () => {
        await deleteChatAndCreateNew();
        window.location.reload();
      })();
    }
    const handleUnload = (event: BeforeUnloadEvent) => {
      if (!isActive || !isAuthenticated) return;
      const storedChatId = window.location.href.match(/\/c\/([A-Za-z0-9\-_]+)/)?.[1];
      if (storedChatId) {
          event.preventDefault();
          localStorage.setItem("gptr/pendingDelete", storedChatId);
          deleteChatAndCreateNew(false);
      }
    };
  
    window.addEventListener("beforeunload", handleUnload);
    return () => {
      window.removeEventListener("beforeunload", handleUnload);
    };
  }, [isActive, isAuthenticated]);

  // Makes sure that chat history is updated after unload delete
  useEffect(() => {
    if (!isAuthenticated) return;
    const storedChatId = localStorage.getItem("gptr/pendingDelete");
    if (storedChatId) {
      (async () => {
        await deleteChatAndCreateNew(false, storedChatId);
        localStorage.removeItem("gptr/pendingDelete");
        if (
          window.location.href.startsWith("https://chatgpt.com") &&
          !isOpening.current
        ) {
            window.location.reload();
        }
      })();
    }
  }, [isAuthenticated]);
  
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
    const isPinTutorialAcknowledged = window.localStorage.getItem(
      "gptr/pinTutorialAcknowledged"
    );
    setConfirmed(cnf === "true");
    setShowPinTutorial(isPinTutorialAcknowledged !== "true");
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
      chrome.runtime.sendMessage({ type: "CONTENT_LOADED" }); //indicate to background script that content is loaded
    }
  }, [isAuthenticated, isActive]);

  //check if the send button is present on the dom
  const isSendButtonPresentOnDom = () => {
    const sendButton: HTMLButtonElement | null = document.querySelector("[data-testid='send-button']");
    return sendButton !== null;
  }


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
      textarea.focus();
      document.execCommand("selectAll", false, undefined);
      const didInsert = document.execCommand("insertText", false, text);
      if (!didInsert) {
        textarea.innerHTML = `<p>${text}</p>`;
      }
    } else {
      console.log('Having trouble finding the textarea');
    }
  }

  const isBadModel = () => {
    const isSupportedModel = (models: string | string[]) => MODELS_TO_WARN.some((model) => models.includes(model));
    // if the user has not used a model before, check if the model switcher is present on the dom
    const modelSwitcher = document.querySelector('[data-testid="model-switcher-dropdown-button"]') as HTMLButtonElement;
    if (modelSwitcher) {
      const name = modelSwitcher.innerText;
      // never flag models containing "mini"
      if (name.toLowerCase().includes("mini")) {
        return false;
      }
      return isSupportedModel(modelSwitcher.innerHTML);
    }
    return false
  };

  // ─── extract the entire sequence into one reusable function ───
  const triggerPromptFlow = useCallback(async () => {
    await waitForElement(["[data-testid='create-new-chat-button']", "[aria-label='New chat']"], 5000)
    .then(btn => (btn as HTMLButtonElement).click())
    .catch(() => {
      console.log("create new chat button not found");
    });
    
    try {
      await waitForElement(PROMPT_INPUT_ID, 5000);
    } catch {
      toast({
        description:
          "To use GPT Reader, switch to another chat in ChatGPT before clicking on the GPT Reader button again.",
        style: TOAST_STYLE_CONFIG,
      });
      setIsActive(false);
      return;
    }

    await clickStopButtonIfPresent();

    // GPT now shows the speech button until you type
    addTextToInputAndOpen(chrome.i18n.getMessage("gpt_reader"));

    if (!isSendButtonPresentOnDom()) {
      try {
        await waitForElement("[data-testid='send-button']", 5000);
      } catch {
        setIsActive(false);
        toast({
          description: chrome.i18n.getMessage("chat_error"),
          style: TOAST_STYLE_CONFIG,
        });
        return;
      }
    }

    // clear out any leftover speech-mode UI
    addTextToInputAndOpen("");

    if (isBadModel()) {
      toast({
        description:
          "GPT Reader advises you to select the GPT-4 based models for best results. The current chosen model may be too slow.",
        duration: 5000,
        style: TOAST_STYLE_CONFIG,
      });
    }

    setIsActive(true);
  }, [
    waitForElement,
    clickStopButtonIfPresent,
    addTextToInputAndOpen,
    isSendButtonPresentOnDom,
    isBadModel,
    toast,
    setIsActive,
  ]);

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
    isOpening.current = true;
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
        // To Show POP-UP toast banner for letting user know that you should first login to use GPT reader extension.
        chrome.storage.local.set({ fromExtensionRedirect: true });

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
    
    if (isBadModel()) {
      document.cookie = "oai-is-specific-model=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
      document.cookie = "oai-last-model=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
      window.localStorage.setItem("gptr/reloadDone", "true");
      window.location.href = `${window.location.origin}/?model=auto`;
      return; 
    }

    // * Call banner count API event to the background script
    chrome.runtime.sendMessage({ type: "BANNER_COUNT_API_EVENT" });

    await triggerPromptFlow();
  };

  useEffect(() => {
    if (!isAuthenticated) return;
    const reloaded = window.localStorage.getItem("gptr/reloadDone") === "true";
    if (reloaded) {
      (async () => {
        await onOpenChange(true);
        window.localStorage.removeItem("gptr/reloadDone");
      })();
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isActive) {
      return; // do nothing when overlay is closed
    }
  
    const intervalId = setInterval(() => {
      const retryBtn = document.querySelector<HTMLButtonElement>(
        '[data-testid*="retry"], [data-testid*="regenerate"]'
      );
      if (retryBtn) {
        // Compute minutes until next UTC hour
        const now = new Date();
        const nextHourUtc = new Date(Date.UTC(
          now.getUTCFullYear(),
          now.getUTCMonth(),
          now.getUTCDate(),
          now.getUTCHours() + 1,  // next UTC hour
          0, 0, 0
        ));
        const msUntilNextHour = nextHourUtc.getTime() - now.getTime();
        const minutesLeft = Math.ceil(msUntilNextHour / 60_000);
        console.log("Found retry button—clicking it now.");
        toast({
          description: `ChatGPT hourly limit reached. GPT Reader recommends waiting ${minutesLeft} minute${minutesLeft !== 1 ? 's' : ''} before trying again.`,
          style: TOAST_STYLE_CONFIG
        });
        retryBtn.click();
      }
    }, 15_000);
  
    // Cleanup: stop polling as soon as `isActive` flips false or component unmounts
    return () => {
      clearInterval(intervalId);
    };
  }, [isActive]);
  
        

  const handleConfirm = (state: boolean) => {
    if (!state) return onOpenChange(false);
    window.localStorage.setItem("gptr/confirmation", String(state));
    setConfirmed(state);
    setShowPinTutorial(true);
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
          { confirmed && showPinTutorial && <PinTutorialPopUp open={showPinTutorial} onClose={setShowPinTutorial}/>}
        </DialogContent>
      </Dialog>
      <Toaster />
    </>
  );
}

export default Uploader;
