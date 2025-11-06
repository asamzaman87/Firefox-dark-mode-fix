/* eslint-disable no-self-assign */
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTrigger
} from "@/components/ui/dialog";
import { Toaster } from "@/components/ui/toaster";
import useAuthToken from "@/hooks/use-auth-token";
import { useToast } from "@/hooks/use-toast";
import { DISCOUNT_FREQUENCY, SAFEST_MODEL, IMPORTANT_COOLDOWN_MS, LISTENERS, MODELS_TO_WARN, PROMPT_INPUT_ID, SUBSCRIBER_ANNUAL_NUDGE_FREQUENCY, TOAST_STYLE_CONFIG, TOAST_STYLE_CONFIG_INFO } from "@/lib/constants";
import { choosePreferredModel, cn, collectChatsAboveTopChat, deleteChatAndCreateNew, detectBrowser, fetchAndStoreTopChat, getIsDarkMode, getSubscriptionDetails, handleCheckUserSubscription, isAnnualPriceId, isPremium, isWebReaderFresh, maybeDeleteChat, reconcileScheduledAnnualFlag, restoreRootInfo, waitForElement } from "@/lib/utils";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import AlertPopup from "./alert-popup";
import Content from "./content";
import PinTutorialPopUp from "./pin-tutorial-popup";
import { usePremiumModal } from "@/context/premium-modal";
import PremiumModal from "./premium-modal";
import TrialGiftPopUp from "./trial-gift-popup";
import StartFromPopUp from "./start-from-popup";
import { SectionIndex } from "@/hooks/use-file-reader";
import WebReaderPermissionPopup from "./webreader-permission-popup";
import BillingIssuePopup from "./billing-issue-popup";
import { createCheckoutSession, fetchStripeProducts } from "@/lib/utils";
import AnnualUpsellPopup from "./annual-upsell-popup";
import AnnouncementMessage from "./announcements-popup/announcement-message";

export interface PromptProps {
  text: string | undefined
}

function Uploader() {
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
  const [isOffline, setIsOffline] = useState<boolean>(false)
  const {setIsSubscribed, isSubscribed, setOpen, setReason} = usePremiumModal();
  const isOpeningInProgress = useRef(false);

  const { toast } = useToast();
  const { isAuthenticated } = useAuthToken();
  const wasActive = useRef<boolean>(false);
  const isOpening = useRef<boolean>(false);
  const LOGO = chrome.runtime.getURL('logo-128.png');
  const autoOpen = useRef<boolean>(false);

  const [showTrialGift, setShowTrialGift] = useState<boolean>(false);
  const [trialEndsAt, setTrialEndsAt] = useState<number | null>(null);
  const [pendingTrialAfterPin, setPendingTrialAfterPin] = useState<boolean>(false);
  const [showDiscountPremium, setShowDiscountPremium] = useState<boolean>(false);
  const [showAnnualUpsell, setShowAnnualUpsell] = useState<boolean>(false);

  const [startFromOpen, setStartFromOpen] = useState<boolean>(false);
  const [startFromSections, setStartFromSections] = useState<SectionIndex[]>([]);
  const [startFromSource, setStartFromSource] = useState<"pdf" | "docx" | "text">("text");
  const [startFromFullText, setStartFromFullText] = useState<string>("");
  const startFromConfirmOffsetRef = useRef<(args: { startAt: number; matchLength?: number }) => void>(() => {});
  const deferredSelectedPingRef = useRef<boolean>(false);

  const [showWebReaderPerm, setShowWebReaderPerm] = useState<boolean>(false);
  const [showBillingIssue, setShowBillingIssue] = useState<boolean>(false);

  const [showUpdatePopup, setShowUpdatePopup] = useState<boolean>(false);
  const [availableVersion, setAvailableVersion] = useState<string | null>(null);

  // Important-announcement popup state + per-session gate
  const [showImportantAnnouncement, setShowImportantAnnouncement] = useState<boolean>(false);
  const [importantAnnouncementHtml, setImportantAnnouncementHtml] = useState<string>("");
  const [importantAnnouncementTitle, setImportantAnnouncementTitle] = useState<string>("");

  // 3-2-1 countdown state for the “X”
  const [importantCloseCountdown, setImportantCloseCountdown] = useState<number>(0);
  const [importantCanClose, setImportantCanClose] = useState<boolean>(false);

  const handleBillingIssueUpgrade = async () => {
    try {
      // 1) Read user from storage
      const storageData = await new Promise<{
        email: string;
        name: string;
        openaiId: string;
        picture?: string;
      }>((resolve, reject) => {
        chrome.storage.sync.get(["email", "name", "openaiId", "picture"], (result) => {
          if (chrome.runtime.lastError) return reject(chrome.runtime.lastError);
          resolve(result as any);
        });
      });

      const { email, name, openaiId, picture } = storageData;
      if (!openaiId) return;

      // 2) Get default (non-discount) priceId
      let product: any;
      if (detectBrowser() === "firefox") {
        product = await new Promise<any>((resolve) => {
          chrome.runtime.sendMessage({ type: "GET_PRODUCTS_PRICES" }, (response) =>
            resolve(response)
          );
        });
      } else {
        product = await fetchStripeProducts();
      }
      const priceIdToUse = product?.prices?.priceId;

      // 3) Create checkout session and redirect
      const payload = { openaiId, email, name, picture, priceId: priceIdToUse };
      let sessionUrl: string;
      if (detectBrowser() === "firefox") {
        const session = await new Promise<any>((resolve) => {
          chrome.runtime.sendMessage({ type: "CREATE_CHECKOUT_SESSION", payload }, (response) =>
            resolve(response)
          );
        });
        sessionUrl = session?.url;
      } else {
        const session = await createCheckoutSession(payload);
        sessionUrl = session?.url;
      }

      if (!sessionUrl) {
        throw new Error("No checkout URL");
      }
      setShowBillingIssue(false);
      window.open(sessionUrl, "_self");
    } catch (error) {
      console.error("Checkout error:", error);
      toast({
        description: "Something went wrong while attempting to checkout",
        style: TOAST_STYLE_CONFIG,
        duration: 5000,
      });
      throw error;
    }
  };

  const hasPendingSelectedText = useCallback(async () => {
    const { selectedText } = await chrome.storage.local.get("selectedText");
    return !!(selectedText && selectedText.length);
  }, []);

  const handleImportantOpenChange = (nextOpen: boolean) => {
    // Block closing via X/overlay until countdown is done
    if (!nextOpen && !importantCanClose) return;
    setShowImportantAnnouncement(nextOpen);
  };

  const importantCountdownOverlay = (!importantCanClose && showImportantAnnouncement) ? (
    <div className="gpt:absolute gpt:top-4 gpt:right-4 gpt:z-[999]">
      <div
        aria-hidden="true"
        className="gpt:flex gpt:items-center gpt:justify-center gpt:w-10 gpt:h-10 gpt:rounded-full gpt:bg-white gpt:dark:bg-gray-800 gpt:text-base gpt:text-gray-900 gpt:dark:text-gray-100 gpt:ring-2 gpt:ring-black/10 gpt:shadow-sm gpt:cursor-not-allowed gpt:select-none"
      >
        {importantCloseCountdown || 3}
      </div>
    </div>
  ) : null;

  const isOverlayReady = useCallback(() => {
    // Ready when all first-run surfaces are gone
    return confirmed && !showWebReaderPerm && !showPinTutorial;
  }, [confirmed, showWebReaderPerm, showPinTutorial]);

  const maybeProceedSelectedText = useCallback(async () => {
    if (!await hasPendingSelectedText()) {
      await chrome.storage.local.set({ iswebreader: 0 });
      return;
    }

    if (!isActive) return;

    if (!deferredSelectedPingRef.current) return;

    if (!isOverlayReady()) return;
    
    if (!await isWebReaderFresh()) return;

    chrome.runtime.sendMessage({ type: "PROCEED_SELECTED_TEXT" });
    deferredSelectedPingRef.current = false;
  }, [isOverlayReady, hasPendingSelectedText, isActive]);

  // ⬇️ Listen for the background's neutral overlay ping, then gate & proceed
  useEffect(() => {
    const onMsg = (message: any) => {
      if (message?.type === "OVERLAY_PING") {
        deferredSelectedPingRef.current = true;
        void maybeProceedSelectedText();
      }
    };
    chrome.runtime.onMessage.addListener(onMsg);
    return () => chrome.runtime.onMessage.removeListener(onMsg);
  }, [maybeProceedSelectedText]);

  // Re-check whenever gates change (ensures auto-open after popups resolve)
  useEffect(() => {
    void maybeProceedSelectedText();
  }, [confirmed, showWebReaderPerm, showPinTutorial, maybeProceedSelectedText]);


  useEffect(() => {
    if (!isActive) return;
    setShowWebReaderPerm(!localStorage.getItem("webReaderFxAck"));
    return;
  }, [isActive]);

  const handlePrimaryWebReader = useCallback(async () => {
    localStorage.setItem("webReaderFxAck", "true");
    setShowWebReaderPerm(false);
    toast({
      description: "🎉 Web Reader is ready. Right-click selected text or choose ‘Get all text’.",
      style: TOAST_STYLE_CONFIG_INFO,
    });
    return;
  }, [toast]);
  
  // sending the auth status to the background script
  useMemo(() => {
    chrome.runtime.sendMessage({ isAuthenticated: isAuthenticated, type: LISTENERS.AUTH_RECEIVED });
  }, [isAuthenticated]);

 // ─── ALWAYS hide any ChatGPT “conversation-fetch-error-toast” ───
 useEffect(() => {

  const HIDE_SELECTOR =
  "[data-testid*='conversation-fetch-error'], " +
  ".border-token-border-default.bg-token-main-surface-primary";

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
      restoreRootInfo();
      localStorage.removeItem("gptr/equalIssue");
      localStorage.removeItem("gptr/reloadDone");
      const newChatBtn = document.querySelector<HTMLButtonElement>(
          "[data-testid='create-new-chat-button'], [aria-label='New chat']"
      );
      if (newChatBtn) {
        newChatBtn.click();
      }
      (async () => {
        await collectChatsAboveTopChat();
        const list = JSON.parse(localStorage.getItem("gptr/chatsToDelete") || "[]") as string[];
        try {
          if (Array.isArray(list) && list.length) {
            for (const id of list) {
              await maybeDeleteChat(id);
            }
          }
        } catch {
          // ignore
        }
        await new Promise(r => setTimeout(r, 1500));
        window.location.href = window.location.href;
      })();
    }
    const handleUnload = async (event: BeforeUnloadEvent) => {
      if (!isAuthenticated) return;
      restoreRootInfo();
      localStorage.removeItem("gptr/root-info");
      localStorage.removeItem("gptr/top-chat");

      // If overlay is active, buy as much time as possible
      if (isActive) {
        event.preventDefault();
      }

      // Also try to delete any leftover chats we scheduled in LS (except current if active)
      try {
        const list = JSON.parse(localStorage.getItem("gptr/chatsToDelete") || "[]") as string[];
        if (Array.isArray(list) && list.length) {
          for (const id of list) {
            await maybeDeleteChat(id);
          }
        }
      } catch {
        // ignore
      }
    };
  
    window.addEventListener("beforeunload", handleUnload);
    return () => {
      window.removeEventListener("beforeunload", handleUnload);
    };
  }, [isActive, isAuthenticated]);

  // On load: delete the pending current chat (if any) and drain the bulk list in one go.
  // Refresh at most once after any successful delete, matching your existing refresh rules.
  useEffect(() => {
    if (!isAuthenticated) return;
    localStorage.removeItem("gptr/top-chat");

    (async () => {
      let shouldRefresh = false;

      // 2) Drain the bulk list of chats to delete
      try {
        const raw = localStorage.getItem("gptr/chatsToDelete") || "[]";
        const list = JSON.parse(raw) as string[];
        if (Array.isArray(list) && list.length) {
          const remaining: string[] = [];
          for (const id of list) {
            try {
              const res = await deleteChatAndCreateNew(false, id);
              if (res?.ok) {
                shouldRefresh = true;
              } else if (res?.status !== 404) {
                remaining.push(id);
              }
            } catch {
              remaining.push(id);
            }
          }
          localStorage.setItem("gptr/chatsToDelete", JSON.stringify(remaining));
        }
      } catch {
        // ignore parse errors
      }

      // 3) Refresh once if anything was deleted, preserving your existing rules
      if (
        shouldRefresh &&
        window.location.href.startsWith("https://chatgpt.com") &&
        !isOpening.current &&
        localStorage.getItem("gptr/active") !== "true"
      ) {
        await new Promise(r => setTimeout(r, 1500));
        window.location.href = window.location.href;
      }
    })();
  }, [isAuthenticated]);
  
  // 2a) Inject the helper script ONCE
  useEffect(() => {
    if (!document.getElementById("fix-this-injected")) {
      const s = document.createElement("script");
      s.id = "fix-this-injected";
      s.src = chrome.runtime.getURL("injected.js");
      (document.head || document.documentElement).appendChild(s);
    }
    // tell background we’re here
    chrome.runtime.sendMessage({ type: "CONTENT_LOADED" });

    //checking if user has already confirmed the extension
    const cnf = window.localStorage.getItem("gptr/confirmation");
    const isPinTutorialAcknowledged = window.localStorage.getItem(
      "gptr/pinTutorialAcknowledged"
    );
    setConfirmed(cnf === "true");
    setShowPinTutorial(isPinTutorialAcknowledged !== "true");
  }, []);

  // Tiny fast hash for content fingerprint
  const hashString = (s: string) => {
    let h = 5381;
    for (let i = 0; i < s.length; i++) h = (h * 33) ^ s.charCodeAt(i);
    return (h >>> 0).toString(36); // short, stable string
  };

  const fpAnnouncement = (a: {
    id?: string;
    title?: string;
    message?: string;
    created_on?: string | Date;
  }) => {
    // Identity component: prefer server id; else created_on ISO
    const idPart =
      a?.id && typeof a.id === "string"
        ? `id:${a.id}`
        : `c:${a?.created_on ? new Date(a.created_on).toISOString() : ""}`;

    // Content component: normalized title + message
    const content = `${(a?.title || "").trim()}|${(a?.message || "").trim()}`;
    const contentHash = hashString(content);

    // Single merged fingerprint (identity + content)
    return `${idPart}|h:${contentHash}`;
  };


  // 2b) ALWAYS register a message listener
  useEffect(() => {
    const onMsg = (message: any, _sender: any, sendResponse: (r?: any) => void) => {
      if (message?.type === "PING") {
        sendResponse({ ok: true });
        return;
      }
      if (message?.type === "GET_BANNER" && Array.isArray(message?.payload)) {
        (async () => {
          try {
            const list = message.payload as Array<{
              id?: string;
              title?: string;
              message?: string;
              important?: boolean;
              only_chrome?: boolean;
              created_on?: string | Date;
            }>;

            // 1) find the latest important (single item)
            const latestImportant = list
              .filter(a => a?.important === true)
              .sort((a, b) => {
                const da = new Date(a.created_on || 0).getTime();
                const db = new Date(b.created_on || 0).getTime();
                return db - da;
              })[0];

            if (!latestImportant) return; // no important items at all

            // 2) Firefox suppression if flagged as chrome-only
            const isFirefox = detectBrowser() === "firefox";
            const isFirefoxBlocked = latestImportant.only_chrome === true && isFirefox;
            if (isFirefoxBlocked) return;

            // 3) Decide using merged fingerprint + cooldown
            const currentFP = fpAnnouncement(latestImportant);
            const { lastImportantSeenFP, lastImportantSeenAt } =
              await chrome.storage.local.get(["lastImportantSeenFP", "lastImportantSeenAt"]);

            let shouldShow = false;

            if (lastImportantSeenFP !== currentFP) {
              // New identity or same identity but content changed → show immediately
              shouldShow = true;
            } else {
              // Same fingerprint → apply 30-min cooldown
              const last = typeof lastImportantSeenAt === "number" ? lastImportantSeenAt : 0;
              if (Date.now() - last >= IMPORTANT_COOLDOWN_MS) {
                shouldShow = true;
              }
            }

            if (!shouldShow) return;

            // 4) Show and persist the merged fingerprint + timestamp
            setImportantAnnouncementTitle(latestImportant.title || "Announcement");
            setImportantAnnouncementHtml(latestImportant.message || "");
            setShowImportantAnnouncement(true);
            await chrome.storage.local.set({
              lastImportantSeenFP: currentFP,
              lastImportantSeenAt: Date.now(),
            });
          } catch {
            // no-op
          }
        })();
        return;
      }
      if (message?.type === "SHOW_UPDATE_POPUP") {
        // Only surface this when the extension overlay is active
        const overlayActive = window.localStorage.getItem("gptr/active") === "true";
        if (!overlayActive) return;

        setAvailableVersion(message?.payload?.newVersion ?? null);
        setShowUpdatePopup(true);
        return;
      }
      if (message?.type === "OPEN_POPUP") {
        if (message.payload === "VERIFY_ORIGIN") {
          chrome.runtime.sendMessage({ type: "VERIFY_ORIGIN" });
          return;
        }
        if (message.payload === "ORIGIN_VERIFIED") {
          (async () => {
            const active = window.localStorage.getItem("gptr/active");
            if (active && active !== "true") {
              activateButton.current?.click();
            }
            while (window.localStorage.getItem("gptr/active") !== "true") {
              await new Promise(r => setTimeout(r, 100));
            }
            chrome.runtime.sendMessage({ type: "TAB_ACTIVATED" });
          })();
        }
      }
    };
    chrome.runtime.onMessage.addListener(onMsg);
    return () => chrome.runtime.onMessage.removeListener(onMsg);
  }, []);

  useEffect(() => {
    if (!showImportantAnnouncement) return;

    setImportantCanClose(false);
    setImportantCloseCountdown(3);

    const id = setInterval(() => {
      setImportantCloseCountdown(prev => {
        if (prev <= 1) {
          clearInterval(id);
          setImportantCanClose(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(id);
  }, [showImportantAnnouncement]);


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
    let textarea = document.querySelector(PROMPT_INPUT_ID) as HTMLTextAreaElement;
    if (!textarea) {
      textarea = document.querySelector("textarea.text-token-text-primary") as HTMLTextAreaElement;
    }
    if (textarea) {
      textarea.focus();
      document.execCommand("selectAll", false, undefined);
      const didInsert = document.execCommand("insertText", false, text);
      if (!didInsert) {
        textarea.innerHTML = `<p>${text}</p>`;
      }
      
      // Dispatch an input event so ChatGPT picks up the change
      const inputEvt = new InputEvent('input', { bubbles: true });
      textarea.dispatchEvent(inputEvt);
    } else {
      console.log('Having trouble finding the textarea');
    }
  }

  // ─── extract the entire sequence into one reusable function ───
  const triggerPromptFlow = useCallback(async () => {
    await waitForElement(["[data-testid='create-new-chat-button']", "[aria-label='New chat']"], 5000)
    .then(btn => (btn as HTMLButtonElement).click())
    .catch(() => {
      console.log("create new chat button not found");
    });

    try {
      await waitForElement([PROMPT_INPUT_ID, "textarea.text-token-text-primary"], 5000);
    } catch {
      toast({
        description:
          "To use Fix this, switch to another chat in ChatGPT before clicking on the Fix this button again.",
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
          description: "Fix this is having trouble opening. Refresh your page, and try again.",
          style: TOAST_STYLE_CONFIG,
        });
        addTextToInputAndOpen("");
        return;
      }
    }

    // clear out any leftover speech-mode UI
    addTextToInputAndOpen("");
    // open the popup
    setIsActive(true);
    // remove in case it was set
    localStorage.removeItem("gptr/equalIssue");
  }, [
    waitForElement,
    clickStopButtonIfPresent,
    addTextToInputAndOpen,
    isSendButtonPresentOnDom,
    toast,
    setIsActive,
  ]);

  const onOpenChange = useCallback(
    async (open: boolean) => {
      if (isOpeningInProgress.current) return;
      isOpeningInProgress.current = true;
      try {
        if (!open) {
          //show confirmation for cancel download if download is in progress
          const download = window.localStorage.getItem("gptr/download");
          if (download && download === "true") {
            setIsCancelDownloadConfirmation(true);
            return;
          }
          setIsActive(false);
          return;
        } else {
          localStorage.setItem("gptr/download", "false");
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
          const loginBtn: HTMLButtonElement | null = document.querySelector(
            "[data-testid='login-button']"
          );
          if (loginBtn) {
            // To Show POP-UP toast banner for letting user know that you should first login to use Fix this extension.
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
        await choosePreferredModel();
        await triggerPromptFlow();
        await fetchAndStoreTopChat();
        isOpeningInProgress.current = false;
        window.localStorage.removeItem("gptr/reloadDone");

        const introButton = document.querySelector("[data-testid='getting-started-button']") as HTMLDivElement | null;
        if (introButton) {
          introButton.click();
        }

        if (!autoOpen.current) {
          // * Call banner count API event to the background script
          chrome.runtime.sendMessage({ type: "BANNER_COUNT_API_EVENT" });
        } else {
          autoOpen.current = false;
        }

        let effectiveIsSubscribed = false;

        const prev = await chrome.storage.local.get("hasSubscription");
        const prevHasSub = prev?.hasSubscription ?? false;

        if (detectBrowser() === "firefox") {
          effectiveIsSubscribed = await new Promise<boolean>((resolve) => {
            chrome.runtime.sendMessage({ type: "CHECK_SUBSCRIPTION" }, (response) => {
              resolve(response);
            });
          });
        } else {
          effectiveIsSubscribed = await handleCheckUserSubscription();
        }

        if (prevHasSub === true && effectiveIsSubscribed === false) {
          setShowBillingIssue(true);
          setShowDiscountPremium(false);
        }

        if (prevHasSub === false && effectiveIsSubscribed === true) {
          toast({description: "Welcome! Thank you for being a paying member. 🥳", style: TOAST_STYLE_CONFIG_INFO, duration: 10000});
        }

        setIsSubscribed(effectiveIsSubscribed);

        try {
          const { isTrial, trialEndsAt } = await chrome.storage.local.get([
            "isTrial",
            "trialEndsAt",
          ]);
          const alreadyShown = window.localStorage.getItem("gptr/trialGiftShown") === "true";
          if (isTrial && !alreadyShown) {
            if (showPinTutorial) {
              // Pin tutorial is visible; defer the trial popup
              setPendingTrialAfterPin(true);
            } else {
              // Show trial now
              setTrialEndsAt(typeof trialEndsAt === "number" ? trialEndsAt : null);
              setShowTrialGift(true);
            }
          }
        } catch {
          // ignore
        }

        // After subscription/trial/pin gating:
        // A) Free users: track opens and maybe show discount premium
        // B) Subscribed users: every Nth open, nudge annual
        try {
          // A) Free users
          if (!effectiveIsSubscribed) {
            localStorage.removeItem("gptr/annualPlan");
            const { openCount = 0 } = await chrome.storage.local.get(["openCount"]);
            const newCount = (typeof openCount === "number" ? openCount : 0) + 1;
            await chrome.storage.local.set({ openCount: newCount });

            // Show every Nth open; skip if Pin Tutorial is still visible or Trial gift is queued
            const isEveryN = newCount % DISCOUNT_FREQUENCY === 0 && newCount > 0;
            const pinVisible = showPinTutorial;
            const trialWillShow = pendingTrialAfterPin || showTrialGift;

            if (isEveryN && !pinVisible && !trialWillShow) {
              setShowDiscountPremium(true);
            }
          } else {
            // B) Subscribed users (exclude trial or cancelled)
            const { isTrial: trialFlag = false, isSubscriptionCancelled = false } =
              await chrome.storage.local.get(["isTrial", "isSubscriptionCancelled"]);
            if (!trialFlag && !isSubscriptionCancelled) {
              try {
                // Determine current plan and scheduled-annual status
                let details;
                if (detectBrowser() === "firefox") {
                  details = await new Promise<any>((resolve) => {
                    chrome.runtime.sendMessage({ type: "GET_SUBSCRIPTION_DETAILS" }, (response) =>
                      resolve(response)
                    );
                  });
                } else {
                  details = await getSubscriptionDetails();
                }
                const currentId = details?.currentPriceId ?? null;
                const scheduledAnnual = reconcileScheduledAnnualFlag();
                if (isAnnualPriceId(currentId)) {
                  localStorage.setItem("gptr/annualPlan", "true");
                } else {
                  localStorage.removeItem("gptr/annualPlan");
                }

                // Only count/nudge on MONTHLY and not-scheduled-to-annual
                if (currentId && !isAnnualPriceId(currentId) && !scheduledAnnual) {
                  const { premiumOpenCount = 0 } = await chrome.storage.local.get([
                    "premiumOpenCount",
                  ]);
                  const nextCount =
                    (typeof premiumOpenCount === "number" ? premiumOpenCount : 0) + 1;
                  await chrome.storage.local.set({ premiumOpenCount: nextCount });

                  const shouldNudge =
                    nextCount % SUBSCRIBER_ANNUAL_NUDGE_FREQUENCY === 0 && nextCount > 0;
                  if (shouldNudge) {
                    setShowAnnualUpsell(true);
                  }
                }
              } catch {
                /* silent: if details fail, do nothing (no count, no nudge) */
              }
            }
          }
        } catch {
          // ignore counting errors
        }
      } catch (error) {
        console.error("onOpenChange error:", error);
      } finally {
        isOpeningInProgress.current = false;
      }
    },
    [isAuthenticated, isSubscribed, showPinTutorial, pendingTrialAfterPin, showTrialGift]
  );
  
  useEffect(() => {
    if (!isAuthenticated) return;
    const params = new URLSearchParams(window.location.search);
    const success = params.get("success");
    const sessionId = params.get("session_id");
    if (success === "true" && sessionId) {
      onOpenChange(true);
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) return;

    const run = async () => {
      const reloaded =
        window.localStorage.getItem("gptr/reloadDone") === "true";

      if (reloaded || await isWebReaderFresh()) {
        autoOpen.current = true;
        await onOpenChange(true);
        chrome.runtime.sendMessage({ type: "TAB_ACTIVATED" });
      }
    };

    run();
  }, [isAuthenticated]);

  useEffect(() => {
    const root = document.documentElement;

    const saveRootInfo = () => {
      if (localStorage.getItem("gptr/active") !== "true") {
        const info = {
          classList: Array.from(root.classList),
          colorScheme: root.style.colorScheme || "",
        };
        localStorage.setItem("gptr/root-info", JSON.stringify(info));
        // Don't overwrite extension theme with ChatGPT's colorScheme
        // console.log("Stored root COLOR", root.style.colorScheme);
      }
    };

    // Save once immediately
    saveRootInfo();

    // Watch for changes to the style attribute
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (
          mutation.type === "attributes" &&
          mutation.attributeName === "style"
        ) {
          saveRootInfo();
        }
      }
    });

    observer.observe(root, { attributes: true, attributeFilter: ["style"] });

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!isActive) return; // do nothing when overlay is closed

    const minutesUntilNextUtcHour = () => {
      const now = new Date();
      const nextHourUtc = new Date(Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate(),
        now.getUTCHours() + 1,
        0, 0, 0
      ));
      return Math.ceil((nextHourUtc.getTime() - now.getTime()) / 60_000);
    };

    const findLimitBannerMinutes = (): number | null => {
      // Look for the new banner text:
      // "You've reached your message limit." and nearby "try again in 24 minutes"
      const candidates = Array.from(document.querySelectorAll<HTMLElement>('h3,div,p,span'));

      const header = candidates.find(el =>
        (el.textContent || '').toLowerCase().includes("you've reached your message limit")
      );

      if (!header) return null;

      // Search the closest container text for "try again in <n> minute"
      const scopeText =
        (header.closest('aside,div')?.textContent ||
          header.parentElement?.textContent ||
          header.textContent ||
          '').toLowerCase();

      const match = scopeText.match(/try again in\s+(\d+)\s+minutes?/);
      if (match && match[1]) {
        const mins = parseInt(match[1], 10);
        if (!Number.isNaN(mins)) return mins;
      }

      return null; // found the banner, but no explicit minute count
    };

    const intervalId = setInterval(() => {
      // Detector #1 (existing): presence of retry/regenerate button
      const retryBtn = document.querySelector<HTMLButtonElement>(
        '[data-testid*="retry"], [data-testid*="regenerate"]'
      );

      // Detector #2 (new): the banner shown in your screenshot
      const bannerMinutes = findLimitBannerMinutes();

      if (retryBtn || bannerMinutes !== null) {
        const minutesLeft =
          bannerMinutes !== null ? bannerMinutes : minutesUntilNextUtcHour();

        toast({
          description: `ChatGPT hourly limit reached. Fix this recommends waiting ${minutesLeft} minute${minutesLeft !== 1 ? 's' : ''} before trying again.`,
          style: TOAST_STYLE_CONFIG,
          duration: 30000
        });

        // If retry/regenerate is present, click it to clear state like before
        if (retryBtn) retryBtn.click();
      }
    }, 60_000);

    // Cleanup: stop polling as soon as `isActive` flips false or component unmounts
    return () => {
      clearInterval(intervalId);
    };
  }, [isActive]);

  // Hide ChatGPT's fetch/limit toasts
  useEffect(() => {
    if (!isActive) return;
    const hide = (root: ParentNode = document) => {
      root.querySelectorAll<HTMLElement>('[data-ignore-for-page-load="true"]').forEach((el) => {
        // Hide the toast container if present; otherwise hide the element itself
        (el.closest('[role="status"], [role="alert"], .toast-root') as HTMLElement || el).style.display = "none";
      });
    };
    hide(); // initial pass
    const mo = new MutationObserver((mutations) => {
      for (const m of mutations) {
        for (const n of Array.from(m.addedNodes)) {
          if (n && n.nodeType === 1) hide(n as ParentNode);
        }
      }
    });
    mo.observe(document.body, { childList: true, subtree: true });
    return () => mo.disconnect();
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
      // if (detectBrowser() === "firefox") {
      //   const root = document.documentElement;
      //   let theme_color = "light";
      //   root.classList.remove("light", "dark")
      //   root.classList.add(theme_color)
      //   root.style["colorScheme"] = theme_color
      // }
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
            className={cn("gpt:shadow-md gpt:absolute gpt:flex gpt:justify-center gpt:items-center z-[101] gpt:top-60 gpt:right-0 gpt:rounded-l-full! gpt:dark:border-gray-700 gpt:dark:bg-gray-900 gpt:bg-gray-100 gpt:border-gray-200  gpt:p-2 gpt:border gpt:border-r-0  gpt:transition-all",
              {
                "gpt:!z-[50]": isActive || isOverlayFallback,
              })
            }
          >
            <img src={LOGO} alt="Fix this Logo" className="gpt:size-6" />{!minimised && (
              <> {!isAuthenticated && chrome.i18n.getMessage("login_to_use")} {isAuthenticated && chrome.i18n.getMessage("activate")} Fix this & Transcriber</>
            )}
          </Button>
        </DialogTrigger>
        <DialogContent
          onInteractOutside={(e: Event) => {
            e.preventDefault(); //prevents mask click close
          }}
          className={cn("gpt:bg-gray-100 gpt:dark:bg-gray-800 gpt:max-w-screen gpt:h-full gpt:border-none gpt:flex gpt:flex-col gpt:gap-4", prompts?.length && "gpt:pb-0")}
        >
          {showWebReaderPerm && (
            <WebReaderPermissionPopup
              onPrimary={handlePrimaryWebReader}
            />
          )}
          {!showWebReaderPerm && (
            <>
              {!confirmed && <AlertPopup setConfirmed={handleConfirm} />}
              {confirmed && (
                <Content
                  isCancelDownloadConfirmation={isCancelDownloadConfirmation}
                  setIsCancelDownloadConfirmation={setIsCancelDownloadConfirmation}
                  onOverlayOpenChange={onOpenChange}
                  setPrompts={setPrompts}
                  prompts={prompts}
                  onOpenStartFrom={({ sections, source, fullText, onConfirm }) => {
                    setStartFromSections(sections);
                    setStartFromSource(source);
                    setStartFromFullText(fullText);
                    startFromConfirmOffsetRef.current = onConfirm;
                    setStartFromOpen(true);
                  }}
                />
              )}
            </>
          )}
          {confirmed && (() => {
            // Robust dark-mode detector (same as update popup)
            const textColor = getIsDarkMode() ? "#ffffff" : "#000000";

            return (
              <Dialog open={showImportantAnnouncement} onOpenChange={handleImportantOpenChange}>
                <DialogContent
                  onInteractOutside={(e) => e.preventDefault()}
                  className="gpt:bg-gray-50 gpt:dark:bg-gray-800 gpt:border-none gpt:w-[95vw] gpt:max-w-[680px] gpt:rounded-2xl gpt:flex gpt:flex-col gpt:items-center gpt:justify-center gpt:text-center gpt:py-10 gpt:px-6"
                >
                  {/* Countdown pill overlays X spot while locked */}
                  {importantCountdownOverlay}

                  <div className="gpt:flex gpt:flex-col gpt:items-center gpt:justify-center gpt:gap-4 gpt:w-full gpt:max-w-[560px]">
                    {/* Title (forced color) */}
                    <h2
                      style={{ color: textColor }}
                      className="gpt:text-2xl gpt:font-semibold gpt:mt-2 gpt:leading-snug"
                    >
                      {importantAnnouncementTitle}
                    </h2>

                    {/* Body (forced color) */}
                    <div
                      style={{ color: textColor }}
                      className="gpt:font-medium gpt:leading-relaxed gpt:text-base gpt:mt-2 gpt:max-w-[520px] gpt:mx-auto"
                    >
                      <AnnouncementMessage message={importantAnnouncementHtml} />
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            );
          })()}

          { confirmed && showPinTutorial && (
            <PinTutorialPopUp
              open={showPinTutorial}
              onClose={(open) => {
                setShowPinTutorial(open);
                // When Pin closes AND a trial is pending, show it now
                if (!open && pendingTrialAfterPin) {
                  setPendingTrialAfterPin(false);
                  chrome.storage.local
                    .get(["isTrial", "trialEndsAt"])
                    .then(({ isTrial, trialEndsAt }) => {
                      const alreadyShown = window.localStorage.getItem("gptr/trialGiftShown") === "true";
                      if (isTrial && !alreadyShown) {
                        setTrialEndsAt(typeof trialEndsAt === "number" ? trialEndsAt : null);
                        setShowTrialGift(true);
                      }
                    })
                    .catch(() => {});
                }
              }}
            />
          )}
          { confirmed && (
            <TrialGiftPopUp
              open={showTrialGift}
              trialEndsAt={trialEndsAt}
              onClose={(open) => {
                setShowTrialGift(open);
                if (!open) window.localStorage.setItem("gptr/trialGiftShown", "true");
              }}
            />
          )}
          {confirmed && (
            <BillingIssuePopup
              open={showBillingIssue}
              onClose={setShowBillingIssue}
              onUpgrade={handleBillingIssueUpgrade}
              openPremiumModal={() => {
                setOpen(true);
                setReason("You no longer have access to premium. Upgrade again if you want to access premium features.");
              }}
            />
          )}
          { confirmed && (
            <PremiumModal
              open={showDiscountPremium}
              onOpenChange={setShowDiscountPremium}
              forceDiscount
            />
          )}
          {confirmed && (() => {
            const textColor = getIsDarkMode() ? "#ffffff" : "#000000";

            return (
              <Dialog open={showUpdatePopup} onOpenChange={setShowUpdatePopup}>
                <DialogContent
                  onInteractOutside={(e) => e.preventDefault()}
                  className="gpt:bg-gray-50 gpt:dark:bg-gray-800 gpt:border-none gpt:w-[95vw] gpt:max-w-[580px] gpt:rounded-2xl"
                >
                  <div className="gpt:flex gpt:flex-col gpt:items-center gpt:text-center gpt:gap-3">
                    {/* Title (forced color) */}
                    <div
                      style={{ color: textColor }}
                      className="gpt:text-xl gpt:font-semibold"
                    >
                      Update Available
                    </div>

                    {/* Description (forced color) */}
                    <p
                      style={{ color: textColor }}
                      className="gpt:text-sm gpt:leading-relaxed"
                    >
                      A newer version{availableVersion ? ` (${availableVersion})` : ""} is available.
                      Click on the button below to open the page and then find the update button. Make sure to refresh this page after the update.
                    </p>

                    <div className="gpt:flex gpt:flex-col gpt:gap-2 gpt:w-full gpt:mt-2">
                      <Button
                        onClick={() => chrome.runtime.sendMessage({ type: "OPEN_EXTENSIONS_PAGE" })}
                        className="
                          gpt:w-full gpt:font-medium gpt:py-2 gpt:px-4 gpt:rounded-full
                          gpt:bg-gray-800 gpt:dark:bg-gray-50
                          gpt:!text-gray-50 gpt:dark:!text-gray-800
                        "
                      >
                        Update in Extensions Manager
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            );
          })()}
          {/* NEW: Annual Upsell for subscribed users */}
          {confirmed && (
            <AnnualUpsellPopup
              open={showAnnualUpsell}
              onOpenChange={setShowAnnualUpsell}
            />
          )}
          <StartFromPopUp
            open={startFromOpen}
            sections={startFromSections}
            source={startFromSource}
            fullText={startFromFullText}
            onConfirm={(args) => {
              setStartFromOpen(false);
              startFromConfirmOffsetRef.current?.(args);
            }}
            onClose={(open) => setStartFromOpen(open)}
          />
        </DialogContent>
      </Dialog>
      <Toaster />
    </>
  );
}

export default Uploader;
