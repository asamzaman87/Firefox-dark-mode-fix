/* eslint-disable @typescript-eslint/no-explicit-any */
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { ACCEPTED_FILE_TYPES, ACCEPTED_FILE_TYPES_FIREFOX, BACKEND_URI, CHUNK_SIZE, CHUNK_TO_PAUSE_ON, DISCOUNT_PRICE_ANNUAL_ID, DISCOUNT_PRICE_ID, DOWLOAD_CHUNK_SIZE, FIRST_DISCOUNT_PRICE_ANNUAL_ID, FIRST_DISCOUNT_PRICE_ID, FRAME_MS, LISTENERS, LIVE_ANALYSER_WINDOW, LOCAL_LOGS, MATCH_URLS, MAX_SLIDER_VALUE, MIN_SILENCE_MS, MIN_SLIDER_VALUE, ORIGINAL_PRICE_ANNUAL_ID, ORIGINAL_PRICE_ID, PROMPT_INPUT_ID, REFRESH_MARGIN_MS, SCHEDULED_199_AT, SCHEDULED_199_FLAG, SCHEDULED_ANNUAL_AT, SCHEDULED_ANNUAL_FLAG, STEP_SLIDER_VALUE, TOAST_STYLE_CONFIG, TOAST_STYLE_CONFIG_INFO, TOKEN_TTL_MS, TRANSCRIBER_ACCEPTED_FILE_TYPES, TRANSCRIBER_ACCEPTED_FILE_TYPES_FIREFOX } from "./constants";
import { CheckoutPayloadType, FetchUserType, Product } from "@/pages/content/uploader/premium-modal";
import { toast, TOAST_REMOVE_DELAY } from "@/hooks/use-toast";
import { generateTranscriptPDF } from "../pages/content/uploader/previews/text-to-pdf";
import { pdf } from '@react-pdf/renderer';
import { saveAs } from 'file-saver';

// LocalStorage list so Uploader can also clean these up
const LS_CHATS_TO_DELETE = "gptr/chatsToDelete";
export const readChatsToDelete = (): string[] => {
    try { return JSON.parse(localStorage.getItem(LS_CHATS_TO_DELETE) || "[]"); } catch { return []; }
};
export const writeChatsToDelete = (ids: string[]) => {
    localStorage.setItem(LS_CHATS_TO_DELETE, JSON.stringify([...new Set(ids)]));
};
export const addChatToDeleteLS = (chatId?: string) => {
    if (!chatId) chatId = window.location.href.match(/\/c\/([A-Za-z0-9\-_]+)/)?.[1] ?? "";
    const list = readChatsToDelete();
    if (!list.includes(chatId)) writeChatsToDelete([...list, chatId]);
};
export const removeChatFromDeleteLS = (chatId: string) => {
    writeChatsToDelete(readChatsToDelete().filter(id => id !== chatId));
};

export type Chunk = { id: string; text: string, messageId?: string, completed: boolean, isPlaying?: boolean };

/**
 * Wait until `container` has no mutations for `inactivityMs` ms.
 * Only watches child-list and text changes *within* this node.
 */
export function waitForStability(
  container: HTMLElement,
  inactivityMs: number = 100
): Promise<void> {
  return new Promise((resolve) => {
    let timer: number;
    const obs = new MutationObserver(() => {
      clearTimeout(timer);
      timer = window.setTimeout(() => {
        obs.disconnect();
        resolve();
      }, inactivityMs);
    });

    obs.observe(container, {
      childList: true,
      subtree: true,        // still confined to container
      characterData: true,  // catch text-node updates
    });

    // in case it’s already stable
    timer = window.setTimeout(() => {
      obs.disconnect();
      resolve();
    }, inactivityMs);
  });
}

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

//format size from number to MB KB text.
export function formatBytes(
  bytes: number,
  opts: {
    decimals?: number
    sizeType?: "accurate" | "normal"
  } = {}
) {
  const { decimals = 0, sizeType = "normal" } = opts

  const sizes = ["Bytes", "KB", "MB", "GB", "TB"]
  const accurateSizes = ["Bytes", "KiB", "MiB", "GiB", "TiB"]
  if (bytes === 0) return "0 Byte"
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  return `${(bytes / Math.pow(1024, i)).toFixed(decimals)} ${sizeType === "accurate" ? accurateSizes[i] ?? "Bytest" : sizes[i] ?? "Bytes"
    }`
}

export const waitForPrepareChat = (): Promise<{ event: string; data: any }[]> =>
  new Promise(resolve => {
    const handler = (e: CustomEvent) => {
      console.log('PREPARE_RECEIVED in utils');
      window.removeEventListener("PREPARE_RECEIVED", handler as any);
      resolve(e.detail);
    };
    window.addEventListener("PREPARE_RECEIVED", handler as any);
  });

//split text to small chunks
export function splitIntoChunksV2(text: string, chunkSize: number = CHUNK_SIZE): Chunk[] {
  // 1) Sentence segmentation with multilingual support
  // Prefer Intl.Segmenter if present; else fall back to a Unicode-aware regex.
  let rawSegments: string[];
  try {
    const segCtor = (typeof Intl !== "undefined" && (Intl as any).Segmenter) as (new (...args:any[]) => any) | null;
    const seg = segCtor ? new segCtor(undefined, { granularity: "sentence" }) : null;
    if (seg) {
      // Spread iterator of segments into array of strings
      // .segment(text) yields { segment, index, isWordLike } objects
      rawSegments = Array.from((seg as any).segment(text), (s: any) => String(s.segment));
    } else {
      // Fallback: split on a wider set of end-of-sentence marks (incl. CJK),
      // and also treat hard line breaks as boundaries.
      const rx =
        /(?:[^\.\!\?。！？።։…•\n\r]+[\.\!\?。！？።։…•]+[\])'"`’”]*|[^\.\!\?。！？።։…•\n\r]+|\n+)/g;
      rawSegments = text.match(rx) || [];
    }
  } catch {
    const rx =
      /(?:[^\.\!\?。！？።։…•\n\r]+[\.\!\?。！？።։…•]+[\])'"`’”]*|[^\.\!\?。！？።։…•\n\r]+|\n+)/g;
    rawSegments = text.match(rx) || [];
  }

  // Normalize segments: trim and drop empty/newline-only pieces,
  // but keep paragraph boundaries as spaces between segments.
  const preSegments = rawSegments
    .map(s => s.replace(/\s+/g, " ").trim())
    .filter(s => s.length > 0);

  // 2) Guard against single segments that are too large:
  // split any over-long segment into sub-segments at whitespace so none exceed maxChunkSize.
  const maxChunkSize = 4000; // unchanged
  const sentences: string[] = [];
  for (const seg of preSegments) {
    if (seg.length <= maxChunkSize) {
      sentences.push(seg);
      continue;
    }
    // Split a single gigantic segment into word-based parts ≤ maxChunkSize.
    // Works for languages with spaces; for CJK (no spaces), we fall back to hard slicing.
    const parts = seg.split(/\s+/);
    if (parts.length > 1) {
      let buf = "";
      for (const p of parts) {
        const candidate = buf ? `${buf} ${p}` : p;
        if (candidate.length <= maxChunkSize) {
          buf = candidate;
        } else {
          if (buf) sentences.push(buf);
          // p itself may be longer than max (e.g., a massive token). Hard slice if needed.
          if (p.length <= maxChunkSize) {
            buf = p;
          } else {
            // Hard slice long token into chunks of maxChunkSize
            for (let i = 0; i < p.length; i += maxChunkSize) {
              const slice = p.slice(i, i + maxChunkSize);
              if (slice.length === maxChunkSize) sentences.push(slice);
              else buf = slice; // keep remainder in buffer
            }
          }
        }
      }
      if (buf) sentences.push(buf);
    } else {
      // No spaces: hard slice into max-sized pieces
      for (let i = 0; i < seg.length; i += maxChunkSize) {
        sentences.push(seg.slice(i, i + maxChunkSize));
      }
    }
  }

  let currentChunk = "";
  let chunkId = 0;

  const initialChunkSize = chunkSize; // keep your pacing inputs
  let targetSize = initialChunkSize;

  const chunks = sentences.reduce((acc, sentence, i, arr) => {
    const s = sentence.trim();
    const potentialChunk = currentChunk ? `${currentChunk} ${s}` : s;
    const potentialSize = potentialChunk.length;

    const isAtOrOverTarget = potentialSize >= targetSize;
    const isEnd = i === arr.length - 1;

    if (isAtOrOverTarget) {
      // ✅ Key change: finalize the *potential* chunk (includes this sentence),
      // so we don't emit an underfilled chunk followed by a tiny sentence.
      const finalized = potentialChunk.trim();
      if (finalized.length > 0) {
        acc.push({ id: `${chunkId++}`, text: finalized, completed: false });
      }
      currentChunk = ""; // start fresh

      // Keep your existing pacing logic (unchanged)
      const isEveryNthChunk = (chunkId % CHUNK_TO_PAUSE_ON) === 0;
      if (isEveryNthChunk) {
        targetSize = initialChunkSize;
      } else {
        targetSize = Math.min(Math.floor(targetSize * 1.5), maxChunkSize);
      }
    } else {
      currentChunk = potentialChunk;
    }

    if (isEnd) {
      const tail = currentChunk.trim();
      if (tail.length > 0) {
        acc.push({ id: `${chunkId}`, text: tail, completed: false });
      }
    }

    return acc;
  }, [] as Chunk[]);

  return chunks;
}

export function normalizeAlphaNumeric(str: string) {
  // This will keep all Unicode letters and digits
  return str.replace(/[^\p{L}\p{N}]/gu, "").toLowerCase();
}

/**
 * Finds the current chatʼs ID from the URL, sends a PATCH to mark it “is_visible: false,” 
 * then clicks “New Chat.” Assumes that somewhere else in the page you’re listening for
 * “GET_TOKEN” → responding with an “AUTH_RECEIVED” CustomEvent that carries { accessToken }.
 */
export async function deleteChatAndCreateNew(
  createChat: boolean = true,
  chatId?: string
): Promise<Response | void> {
  if (LOCAL_LOGS) return;
  let storedChatId =
    window.location.href.match(/\/c\/([A-Za-z0-9\-_]+)/)?.[1] ?? "";
  if (chatId) {
    storedChatId = chatId;
  }
  if (!storedChatId) return;

  return new Promise<Response | void>((resolve) => {
    const handleAuth = async (e: Event) => {
      window.removeEventListener("AUTH_RECEIVED", handleAuth);
      const { accessToken: token } = (e as CustomEvent<{ accessToken: string }>).detail;
      if (!token) {
        return resolve();
      }

      try {
        const response = await fetch(
          `https://chatgpt.com/backend-api/conversation/${storedChatId}`,
          {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${token}`,
            },
            body: JSON.stringify({ is_visible: false }),
          }
        );

        if (createChat) {
          const newChatBtn = document.querySelector<HTMLButtonElement>(
            "[data-testid='create-new-chat-button'], [aria-label='New chat']"
          );
          newChatBtn?.click();
        }

        resolve(response);
      } catch (err) {
        console.error("Failed to delete chat:", err);
        resolve();
      }
    };

    window.addEventListener("AUTH_RECEIVED", handleAuth, { once: true });
    window.dispatchEvent(new Event("GET_TOKEN"));
  });
}


export function splitIntoChunksV1(text: string, chunkSize: number = DOWLOAD_CHUNK_SIZE): Chunk[] {
  const sentences = text.match(/(?:[^.!?•]+[.!?•]+[\])'"`’”]*|[^.!?•]+(?:$))/g) || []; //matches sentences based on the delimiters
  let currentChunk = "";
  let chunkId = 0;

  return sentences.reduce((chunks, sentence, i, arr) => {
    const isCurrentChunkSizeGreaterThanOrEqualChunkSize = (currentChunk + sentence).length >= chunkSize;
    const isEnd = i === arr.length - 1
    if (isCurrentChunkSizeGreaterThanOrEqualChunkSize) {
      chunks.push({ id: `${chunkId++}`, text: currentChunk.trim(), completed: false });
      currentChunk = sentence.trim();
    } else {
      currentChunk += sentence.trim();
    }

    //handles last chunk if it does not meet the chunk size cnodition
    if (currentChunk && !isCurrentChunkSizeGreaterThanOrEqualChunkSize && isEnd) {
      chunks.push({ id: `${chunkId}`, text: currentChunk.trim(), completed: false });
    }

    return chunks;
  }, [] as Chunk[]);
}

export const extractChunkNumberFromPrompt = (inputString: string): string | null => {
  // Regular expression to match number inside square brackets
  const regex = /\[(\d+)\]/;
  const match = inputString.match(regex);
  if (!match) return null;// Return null if no number is found
  return match[1];  // Return the number inside the brackets as a string
}

//remove all listeners
export const removeAllListeners = () => {
  const listners = Object.values(LISTENERS);
  listners.forEach(listener => {
    window.removeEventListener(listener, () => { });
  });
}

//get all tabs with urls matching the match urls
export const getGPTTabs = async () => {
  const tabs = await chrome.tabs.query({ url: MATCH_URLS });
  if (tabs.length === 0 || !tabs[0].id) return;

  return tabs
}

//switch to active gpt tab if exists otherwise create a new tab and make it active
export const switchToActiveTab = async () => {
  const activeTab = await getGPTTabs();
  if (!activeTab?.length || !activeTab[0].id) {
    const tab = await chrome.tabs.create({ url: "https://chatgpt.com/?model=auto" });
    if (tab.id) {
      await chrome.tabs.update(tab.id, { active: true });
      return tab.id + "::new_tab";
    }
    return
  }
  await chrome.tabs.update(activeTab[0].id, { active: true });
  return activeTab[0].id;
}

const THRESHOLD = 150 * 1000; // 150 seconds in ms
export const isWebReaderFresh = async () => {
  const { iswebreader } = await chrome.storage.local.get("iswebreader");
  
  if (!iswebreader) {
    return false; // nothing stored yet
  }

  const now = Date.now();
  const age = now - iswebreader; // difference in ms

  return age < THRESHOLD;
};

//detect browser type
export const detectBrowser = () => {
  const userAgent = navigator?.userAgent;

  if (userAgent.includes('Firefox')) {
    return 'firefox';
  } else if (userAgent.includes('Chrome')) {
    return 'chrome';
  } else {
    return 'unknown';
  }
};
export function monitorStopButton() {
  let visibleSince: number | null = null;
  const intervalId = window.setInterval(() => {
    const btn = document.querySelector<HTMLButtonElement>("[data-testid='stop-button']");
    if (btn) {
      // first time seeing it?
      if (visibleSince === null) {
        visibleSince = Date.now();
      }
      // held for 4s?
      else if (Date.now() - visibleSince >= 4000) {
        btn.click();
        window.dispatchEvent(new Event("STOP_STREAM_LOOP"));
        clearInterval(intervalId);
      }
    }
    // button disappeared after it had appeared → stop polling
    else if (visibleSince !== null) {
      clearInterval(intervalId);
    }
    // else: button still not shown, keep polling
  }, 500);
}

//generate array of number from a specified range (min and max)
export const generateRange = (min: number = MIN_SLIDER_VALUE, max: number = MAX_SLIDER_VALUE, step: number = STEP_SLIDER_VALUE) => {
  const range = [];
  for (let i = min; i <= max + step; i += step) {
    range.push(parseFloat(i.toFixed(1)));
  }
  return range;
}

//check if shadow gpt root is present (needs to be observed as it get remove on conflic with other extensions like gramarly)
export function observeElement(toObserve: string, cb?: (s: boolean) => void): void {
  const targetNode: Document = document;

  const callback: MutationCallback = () => {

    // Check if the element exists in the DOM
    const isPresent: boolean = !!document.querySelector(toObserve);

    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    cb && cb(isPresent);
  };

  // Create the observer
  const observer: MutationObserver = new MutationObserver(callback);

  // Observe changes in the entire DOM
  observer.observe(targetNode, {
    childList: true, // Watch for added/removed nodes
    subtree: true,   // Watch all descendants of the target node
  });

}

//find the key in local storage that matches the given key
export const findMatchLocalStorageKey = (key: string) => {
  const keys = Object.keys(localStorage);
  for (let i = 0; i < keys.length; i++) {
    if (keys[i].includes(key)) {
      return keys[i];
    }
  }
  return null;
}

export const formatSeconds = (s: number): string => {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);

  const hh = h.toString().padStart(2, "0");
  const mm = m.toString().padStart(2, "0");
  const ss = sec.toString().padStart(2, "0");

  return h === 0 ? `${mm}:${ss}` : `${hh}:${mm}:${ss}`;
};

export async function getToken(): Promise<string> {
  const { jwtToken, jwtTokenExpiry } = await chrome.storage.local.get([
    "jwtToken",
    "jwtTokenExpiry",
  ]);

  const storageData = await new Promise<FetchUserType>((resolve, reject) => {
    chrome.storage.sync.get(["email", "name", "openaiId"], (result) => {
      if (chrome.runtime.lastError) {
        return reject(chrome.runtime.lastError);
      }
      resolve(result as FetchUserType);
    });
  });
  const { email, name, openaiId } = storageData;

  const now = Date.now();

  // Return cached token if still valid
  if (jwtToken && jwtTokenExpiry && now < jwtTokenExpiry - REFRESH_MARGIN_MS) {
    return jwtToken;
  }

  // Fetch new token from backend
  const res = await fetch(`${BACKEND_URI}/auth/token`, {
    method: "POST",
    headers: {
      "X-From-Extension": "true",
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ email, name, openaiId })
  });

  if (!res.ok) {
    console.error("Token fetch failed", await res.text());
    throw new Error("Failed to get token");
  }

  const { token } = await res.json();

  // Store token and expiry
  await chrome.storage.local.set({
    jwtToken: token,
    jwtTokenExpiry: now + TOKEN_TTL_MS,
  });

  return token;
}

export async function secureFetch(
  url: string,
  options: RequestInit = {}
): Promise<any> {
  const ignoreKeys = ["gpt-feedback", "banner"];
  const neglact = ignoreKeys.some(key => url.includes(key));

  const token = await getToken();
  const hashAccessToken = await getStoredValue<string>("hashAccessToken");
  const res = await fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      Authorization: `Bearer ${token}`,
      ...( !neglact && {"Hat-Token": hashAccessToken}),
      "Content-Type": "application/json",
      "X-From-Extension": "true",
    },
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data.message || `Error ${res.status}`);
  }
  return data;
}

export const waitForElement = (
  selector: string | string[],
  timeout = 5000
): Promise<Element> => {
  const combinedSelector = Array.isArray(selector) ? selector.join(", ") : selector;
  // const startTime = performance.now();
  return new Promise((resolve, reject) => {
    const el = document.querySelector(combinedSelector);
    if (el) {
      // const elapsed = performance.now() - startTime;
      // console.log(`Element found immediately after ${elapsed.toFixed(2)} ms`);
      return resolve(el);
    }

    const observer = new MutationObserver(() => {
      const elFound = document.querySelector(combinedSelector);
      if (elFound) {
        observer.disconnect();
        // const elapsed = performance.now() - startTime;
        // console.log(`Element found after ${elapsed.toFixed(2)} ms`);
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

export interface UserType {
  email: string;
  name: string;
  id: string;
  iat: number;
  idp: string;
  image: string;
  intercom_hash: string;
  mfa: boolean;
  picture: string;
}

export async function getStoredValue<T = string>(
  key: string,
  storageType: 'sync' | 'local' = 'sync'
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const storage = chrome.storage[storageType];
    if (!storage) {
      reject(new Error(`Invalid storage type: ${storageType}`));
      return;
    }

    storage.get(key, (res) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve(res[key]);
      }
    });
  });
}

export function isAnnualPriceId(id?: string | null): boolean {
  if (!id) return false;
  return (
    id === DISCOUNT_PRICE_ANNUAL_ID ||
    id === FIRST_DISCOUNT_PRICE_ANNUAL_ID ||
    id === ORIGINAL_PRICE_ANNUAL_ID
  );
}

/**
 * Map a known monthly priceId → its annual counterpart.
 * If `monthlyId` equals your product default, we return ORIGINAL_PRICE_ANNUAL_ID.
 * Returns null if no mapping is known.
 */
export function toAnnualPriceId(
  monthlyId?: string | null,
  defaultMonthlyId?: string | null
): string | null {
  if (!monthlyId) return null;

  if (monthlyId === DISCOUNT_PRICE_ID) return DISCOUNT_PRICE_ANNUAL_ID;
  if (monthlyId === FIRST_DISCOUNT_PRICE_ID) return FIRST_DISCOUNT_PRICE_ANNUAL_ID;
  if (monthlyId === ORIGINAL_PRICE_ID) return ORIGINAL_PRICE_ANNUAL_ID;

  // Treat the product's default monthly id as "original"
  if (defaultMonthlyId && monthlyId === defaultMonthlyId) {
    return ORIGINAL_PRICE_ANNUAL_ID;
  }
  return null;
}

export function clearScheduled199Flags() {
  try {
    window.localStorage.removeItem(SCHEDULED_199_FLAG);
    window.localStorage.removeItem(SCHEDULED_199_AT);
  } catch {
    /* no-op */
  }
}

/** True iff a $1.99 switch is scheduled AND its effective time is in the future. Clears stale flags otherwise. */
export function reconcileScheduled199Flag(nowSec = Math.floor(Date.now() / 1000)): boolean {
  const flag = window.localStorage.getItem(SCHEDULED_199_FLAG) === "true";
  if (!flag) return false;
  const raw = window.localStorage.getItem(SCHEDULED_199_AT);
  const at = raw ? Number(raw) : NaN;

  if (!Number.isFinite(at) || at <= nowSec) {
    clearScheduled199Flags();
    return false;
  }
  return true;
}


export function clearScheduledAnnualFlags() {
  try {
    window.localStorage.removeItem(SCHEDULED_ANNUAL_FLAG);
    window.localStorage.removeItem(SCHEDULED_ANNUAL_AT);
  } catch {
    /* no-op */
  }
}

/**
 * Returns true iff an annual plan switch is scheduled AND its effective timestamp is in the future.
 * If timestamp is missing/invalid/past, clears the local flags and returns false.
 * Reads/writes window.localStorage only.
 */
export function reconcileScheduledAnnualFlag(nowSec = Math.floor(Date.now() / 1000)): boolean {
  const flag = window.localStorage.getItem(SCHEDULED_ANNUAL_FLAG) === "true";
  if (!flag) return false;
  const raw = window.localStorage.getItem(SCHEDULED_ANNUAL_AT);
  const at = raw ? Number(raw) : NaN;

  if (!at) {
    return true;
  }

  // No timestamp, NaN, or already passed → clear & return false
  if (!Number.isFinite(at) || at <= nowSec) {
    clearScheduledAnnualFlags();
    return false;
  }
  return true;
}
export const waitForEditor = async (timeoutMs = 5000) => {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const el = document.querySelector(PROMPT_INPUT_ID) as HTMLElement | null
      || document.querySelector("textarea.text-token-text-primary") as HTMLElement | null;
    if (el) return true;
    await new Promise(r => setTimeout(r, 150));
  }
  return false;
};

export function restoreRootInfo() {
  const saved = localStorage.getItem("gptr/root-info");

  if (!saved) return;

  try {
    const rootInfo = JSON.parse(saved);
    // console.log("Saved root info:", rootInfo);

    const root = document.documentElement;
    root.className = ""; // clear existing classes

    if (Array.isArray(rootInfo.classList)) {
      rootInfo.classList.forEach((cls: string) => root.classList.add(cls));
    }

    if (rootInfo.colorScheme) {
      root.style.colorScheme = rootInfo.colorScheme;
    }
    localStorage.setItem('gptr/next-theme', rootInfo.colorScheme);
  } catch (err) {
    console.error("Could not parse saved root info:", err);
  }
}


function waitForStorageKey<T>(
  key: string,
  storageArea: "sync" | "local" = "sync",
  timeoutMs = 3000,
  intervalMs = 100
): Promise<T | null> {
  return new Promise((resolve) => {
    const start = Date.now();

    const interval = setInterval(() => {
      chrome.storage[storageArea].get(key, (res) => {
        if (res[key]) {
          clearInterval(interval);
          resolve(res[key]);
        } else if (Date.now() - start > timeoutMs) {
          clearInterval(interval);
          resolve(null);
        }
      });
    }, intervalMs);
  });
}

export const handleCheckUserSubscription = async () => {
  try {
    const openaiId = await waitForStorageKey<string>("openaiId", "sync");

    if (!openaiId) {
      console.warn("No OpenAI ID found");
      chrome.storage.local.set({ hasSubscription: true, isTrial: false, trialEndsAt: null });
      return true;
    }

    const data: {
      hasSubscription: boolean;
      subscriptionId: string | null;
      isSubscriptionCancelled: boolean;
      currentPeriodEnd: number | null;
      isTrial?: boolean;
      trialEndsAt?: number | null;
    } = await secureFetch(`${BACKEND_URI}/gpt-reader/check-subscription?openaiId=${openaiId}`);

    const effectiveHasSub = !!(data?.hasSubscription || data?.isTrial);

    await chrome.storage.local.set({
      hasSubscription: effectiveHasSub,
      subscriptionId: data.subscriptionId ?? null,
      isSubscriptionCancelled: data.isSubscriptionCancelled || false,
      currentPeriodEnd: data.currentPeriodEnd ?? null,
      isTrial: !!data?.isTrial,
      trialEndsAt: data?.trialEndsAt ?? null,
    });

    return effectiveHasSub;
  } catch (err) {
    console.error("Error checking subscription:", err);
    // Fallback: allow access if backend down
    chrome.storage.local.set({
      hasSubscription: true,
      subscriptionId: null,
      isSubscriptionCancelled: false,
      currentPeriodEnd: null,
      isTrial: false,
      trialEndsAt: null,
    });
    return true;
  }
};

export const fetchStripeProducts = async () => {
  try {
    const products = await secureFetch(
      `${BACKEND_URI}/gpt-reader/products-list`
    );
    return products[0] || [];
  } catch (error) {
    console.log("Error fetching products:", error);
    throw error;
  }
};

export const createCheckoutSession = async (payload: CheckoutPayloadType) => {
  try {
    const data = await secureFetch(
      `${BACKEND_URI}/gpt-reader/create-checkout-session`,
      { method: "POST", body: JSON.stringify(payload) }
    );

    // 👇 Normalize both server shapes to { url }
    const url =
      data?.session?.url ??
      (data?.action === "pay_existing_invoice" ? data?.url : undefined);

    return url ? { url } : null;
  } catch (error) {
    console.log("Error creating checkout session:", error);
    throw error;
  }
};

export const cancelSubscription = async (subscriptionId: string) => {
  try {
    const res = await secureFetch(
      `${BACKEND_URI}/gpt-reader/cancel-subscription?subscriptionId=${subscriptionId}`,
      { method: "DELETE" }
    );
    return res;
  } catch (error) {
    console.log("Error canceling subscription:", error);
    throw error;
  }
};

export const getSubscriptionDetails = async (): Promise<{
  subscriptionId: string | null;
  currentPriceId: string | null;
  currentPeriodEnd: number | null;
} | null> => {
  try {
    const openaiId = await waitForStorageKey<string>("openaiId", "sync");
    if (!openaiId) return null;
    const data = await secureFetch(
      `${BACKEND_URI}/gpt-reader/subscription-details?openaiId=${openaiId}`,
      { method: "GET" }
    );
    return data;
  } catch {
    return null;
  }
};

export const switchSubscriptionToPrice = async (
  subscriptionId: string,
  priceId: string
): Promise<{
  subscriptionId: string;
  currentPriceId: string | null;
  currentPeriodEnd: number | null;
}> => {
  const data = await secureFetch(
    `${BACKEND_URI}/gpt-reader/switch-subscription-price`,
    { method: "POST", body: JSON.stringify({ subscriptionId, priceId }) }
  );
  return data;
};

export const createHash = async (token: string) => {
  const msgBuffer = new TextEncoder().encode(token);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
};

export function formatPriceFromStripePrice(price?: Product["prices"]): string {
  if (!price) return "USD $0/month";
  const amountInDollars = (price.unit_amount / 100).toFixed(2);
  const currency = price.currency.toUpperCase();
  const interval = price.recurring?.interval ?? '';
  return `${currency} $${amountInDollars}${interval ? `/${interval}` : ''}`;
}

export const handleError = (error: string, duration: number = TOAST_REMOVE_DELAY) => {
    const errorEvent = new CustomEvent(LISTENERS.ERROR, { detail: { message: error} });
    window.dispatchEvent(errorEvent);
    console.error('[handleError]', error);
    if (!error.includes("2500")) toast({ description: error, style: TOAST_STYLE_CONFIG, duration });
    return
}

export function encodeWav(audioBuffer: AudioBuffer): Blob {
  const numChannels = audioBuffer.numberOfChannels;
  const sampleRate = audioBuffer.sampleRate;
  const bitDepth = 16;

  const bytesPerSample = bitDepth / 8;
  const blockAlign = numChannels * bytesPerSample;
  const dataLength = audioBuffer.length * blockAlign;
  const buffer = new ArrayBuffer(44 + dataLength);
  const view = new DataView(buffer);

  let offset = 0;

  const writeString = (str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset++, str.charCodeAt(i));
    }
  };

  // RIFF header
  writeString("RIFF");
  view.setUint32(offset, 36 + dataLength, true);
  offset += 4;
  writeString("WAVE");

  // fmt chunk
  writeString("fmt ");
  view.setUint32(offset, 16, true);
  offset += 4; // Subchunk1Size
  view.setUint16(offset, 1, true);
  offset += 2; // PCM format
  view.setUint16(offset, numChannels, true);
  offset += 2;
  view.setUint32(offset, sampleRate, true);
  offset += 4;
  view.setUint32(offset, sampleRate * blockAlign, true);
  offset += 4;
  view.setUint16(offset, blockAlign, true);
  offset += 2;
  view.setUint16(offset, bitDepth, true);
  offset += 2;

  // data chunk
  writeString("data");
  view.setUint32(offset, dataLength, true);
  offset += 4;

  // PCM samples
  for (let i = 0; i < audioBuffer.length; i++) {
    for (let channel = 0; channel < numChannels; channel++) {
      const sample = audioBuffer.getChannelData(channel)[i];
      const intSample = Math.max(-1, Math.min(1, sample)) * 0x7fff;
      view.setInt16(offset, intSample, true);
      offset += 2;
    }
  }

  return new Blob([view], { type: "audio/wav" });
}

export async function cleanAudioBuffer(
  input: AudioBuffer
): Promise<AudioBuffer | null> {
  const TARGET_SR = 16000;
  const raw = input.getChannelData(0);
  const sr0 = input.sampleRate;

  // ─── 1) FRAME-BASED TRIM using EXACTLY the same window & threshold as live ───
  const frameSize = LIVE_ANALYSER_WINDOW;
  const rmsThresh = 0.02; // exactly the same gate as your live path

  let startSample = 0;
  let foundSpeech = false;
  // find the first frame whose RMS exceeds your gate
  for (let offset = 0; offset + frameSize <= raw.length; offset += frameSize) {
    let sumSq = 0;
    for (let i = 0; i < frameSize; i++) {
      sumSq += raw[offset + i] * raw[offset + i];
    }
    const rms = Math.sqrt(sumSq / frameSize);
    if (rms > rmsThresh) {
      foundSpeech = true;
      startSample = offset;
      break;
    }
  }

  // if we never found any frame > threshold, treat as all-silence
  if (!foundSpeech) {
    return null;
  }

  // ─── add 1 second of lead‐in ───
  const extraLead = sr0; // one second worth of samples at original SR
  const newStart = Math.max(0, startSample - extraLead);
  startSample = newStart;

  let endSample = raw.length;
  // find the last frame whose RMS exceeds your gate
  for (
    let offset = raw.length - frameSize;
    offset >= startSample;
    offset -= frameSize
  ) {
    let sumSq = 0;
    for (let i = 0; i < frameSize; i++) {
      sumSq += raw[offset + i] * raw[offset + i];
    }
    const rms = Math.sqrt(sumSq / frameSize);
    if (rms > rmsThresh) {
      endSample = offset + frameSize;
      break;
    }
  }

  // ─── add 1 second of tail padding ───
  const extraTail = sr0; // one second worth of samples
  const newEnd = Math.min(raw.length, endSample + extraTail);
  endSample = newEnd;

  // if we never saw anything above the gate
  if (endSample <= startSample) {
    return null;
  }

  // copy that exact “speech” region
  const trimmedLen = endSample - startSample;

  const trimmed = new AudioBuffer({
    length: trimmedLen,
    numberOfChannels: 1,
    sampleRate: sr0,
  });
  trimmed.copyToChannel(raw.slice(startSample, endSample), 0);

  // ─── 2) then resample & normalize as before ───
  const offline = new OfflineAudioContext(
    1,
    Math.ceil(trimmed.duration * TARGET_SR),
    TARGET_SR
  );
  const src = offline.createBufferSource();
  src.buffer = trimmed;
  src.connect(offline.destination);
  src.start(0);
  const rendered = await offline.startRendering();

  // normalize peak to ~–3dB
  const rd = rendered.getChannelData(0);
  let peak = 0;
  for (let i = 0; i < rd.length; i++) {
    peak = Math.max(peak, Math.abs(rd[i]));
  }
  if (peak > 0) {
    const gain = 0.7 / peak;
    for (let i = 0; i < rd.length; i++) {
      rd[i] *= gain;
    }
  }

  return rendered;
}

// ─── compute adaptive noise-floor ────────────────────────────────────────────────
export function computeNoiseFloor(
  data: Float32Array,
  sampleRate: number,
  durationMs = 200,
  multiplier = 1.5
): number {
  const samples = Math.floor((durationMs / 1000) * sampleRate);
  let sum = 0;
  for (let i = 0; i < samples; i++) {
    sum += Math.abs(data[i]);
  }
  return (sum / samples) * multiplier;
}

/**
 * Scan channelData and return the first silence‐run **at or after** minChunkSamples.
 * @returns the sample‐index (into channelData) where that run starts, or null if none found.
 */
export function findNextSilence(
  channelData: Float32Array,
  sampleRate: number,
  frameMs = 20,
  silenceThresh = 0.01,
  minSilenceMs = 500,
  minChunkSamples: number
): number | null {
  const frameSize = Math.floor((frameMs / 1000) * sampleRate);
  const minFrames = Math.floor(minSilenceMs / frameMs);
  const thresholdSq = silenceThresh * silenceThresh * frameSize;

  let count = 0;
  const lastOffset = channelData.length - frameSize;

  for (let offset = 0; offset <= lastOffset; offset += frameSize) {
    // accumulate sum of squares for this frame
    let sumSq = 0;
    for (let i = 0; i < frameSize; i++) {
      const v = channelData[offset + i];
      sumSq += v * v;
    }

    if (sumSq < thresholdSq) {
      count++;
      if (count >= minFrames) {
        // compute where this run really started
        const runStart = offset - (minFrames - 1) * frameSize;
        // only accept it if it’s at/after our minimum chunk length
        if (runStart >= minChunkSamples) {
          return runStart;
        }
        // otherwise reset and keep looking
        count = 0;
      }
    } else {
      count = 0;
    }
  }

  return null;
}

export function detectSilence(
  channelData: Float32Array,
  sampleRate: number,
  frameMs = 20,
  silenceThresh = 0.01, // your RMS threshold
  minSilenceMs = 500
): number[] {
  const frameSize = Math.floor((frameMs / 1000) * sampleRate);
  const minSilenceFrames = Math.floor(minSilenceMs / frameMs);

  // precompute sumSq threshold instead of sqrt each time
  const thresholdSq = silenceThresh * silenceThresh * frameSize;

  const silentFrames: number[] = [];
  let count = 0;

  // iterate non-overlapping frames
  const lastOffset = channelData.length - frameSize;
  for (let offset = 0; offset <= lastOffset; offset += frameSize) {
    let sumSq = 0;
    // accumulate v*v (no Math.abs or Math.sqrt!)
    for (let i = 0; i < frameSize; i++) {
      const v = channelData[offset + i];
      sumSq += v * v;
    }

    if (sumSq < thresholdSq) {
      count++;
      if (count >= minSilenceFrames) {
        // mark start of that silent run
        silentFrames.push(offset - (minSilenceFrames - 1) * frameSize);
        count = 0;
      }
    } else {
      count = 0;
    }
  }

  return silentFrames;
}

async function splitBlobIntoParts(
  blob: Blob,
  parts: number,
  audioCtx: AudioContext
): Promise<Blob[]> {
  // 1. Decode & clean the full buffer
  const arrayBuffer = await blob.arrayBuffer();
  const decoded = await audioCtx.decodeAudioData(arrayBuffer);
  const data = decoded.getChannelData(0);
  const sr = decoded.sampleRate;
  const totalSamples = data.length;

  // 2. compute adaptive noise floor and pick threshold
  const noiseFloor = computeNoiseFloor(data, sr);
  const silenceThresh = noiseFloor * 0.8;
  // find silence spots using that threshold
  const silences = detectSilence(
    data,
    sr,
    FRAME_MS,
    silenceThresh,
    MIN_SILENCE_MS
  );

  // 3. Pick split points nearest to 1/parts, 2/parts, … fractions
  const boundaries: number[] = [0];
  // Compute end-of-silence offset
  const frameSize = Math.floor((FRAME_MS / 1000) * sr);
  const minFrames = Math.floor(MIN_SILENCE_MS / FRAME_MS);

  for (let i = 1; i < parts; i++) {
    const target = Math.floor((i * totalSamples) / parts);
    // pick nearest silence **start**
    let rawSplit = target;
    if (silences.length) {
      rawSplit = silences.reduce(
        (prev, curr) =>
          Math.abs(curr - target) < Math.abs(prev - target) ? curr : prev,
        silences[0]
      );
    }
    // shift to the **end** of that silence
    const splitPoint = Math.min(totalSamples, rawSplit + frameSize * minFrames);
    boundaries.push(splitPoint);
  }

  boundaries.push(totalSamples);

  // 4. Slice at those boundaries, re-clean each, and encode
  const result: Blob[] = [];
  for (let j = 0; j < boundaries.length - 1; j++) {
    const start = boundaries[j];
    const end = boundaries[j + 1];
    const len = end - start;
    if (len <= 0) continue;
    // mono buffer segment
    const segment = audioCtx.createBuffer(1, end - start, sr);
    segment.copyToChannel(data.slice(start, end), 0);

    result.push(encodeWav(segment));
  }

  return result;
}

export async function transcribeWithFallback(
  blob: Blob,
  label: string,
  depth = 0,
  token: string,
  audioCtx: AudioContext
): Promise<string> {
  const MIN_TRANSCRIPT_LENGTH = 0; // You can adjust this threshold

  const formData = new FormData();
  formData.append("file", blob, `${label}.wav`);
  formData.append("model", "gpt-4o-transcribe");
  // ↓ make it deterministic
  formData.append("temperature", "0");
  formData.append(
    "prompt",
    "Transcribe each character as spoken in the audio. Do not skip any characters. Make sure to provide the text with the correct punctuation."
  );

  try {
    const res = await fetch("https://chatgpt.com/backend-api/transcribe", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    });

    if (!res.ok) throw new Error(await res.text());
    const result = await res.json();
    // console.log("result before splitting", result);

    const transcript = result?.text?.trim() ?? "";

    // If transcript is empty OR suspiciously short, fallback
    if (
      (transcript.length <= MIN_TRANSCRIPT_LENGTH ||
        transcript.includes("transcript") ||
        transcript.includes("gpt") ||
        transcript.includes("DALL·E") ||
        transcript.includes("OpenAI")) &&
      depth === 0
    ) {
      const splits = await splitBlobIntoParts(blob, 2, audioCtx);

      const results = await Promise.all(
        splits.map((split, idx) =>
          transcribeWithFallback(
            split,
            `${label}_${idx}`,
            depth + 1,
            token,
            audioCtx
          )
        )
      );

      return results.filter(Boolean).join(" ");
    }

    // If transcript is long enough, return it
    return transcript;
  } catch (err) {
    if (depth === 0) {
      const splits = await splitBlobIntoParts(blob, 2, audioCtx);

      const results = await Promise.all(
        splits.map((split, idx) =>
          transcribeWithFallback(
            split,
            `${label}_${idx}`,
            depth + 1,
            token,
            audioCtx
          )
        )
      );
      console.log(err);

      return results.filter(Boolean).join(" ");
    } else {
      toast({
        description:
          "Remember: GPT Transcriber can hallucinate so make sure to review the transcription!",
        style: TOAST_STYLE_CONFIG_INFO,
      });
      return "";
    }
  }
}

export const downloadTranscriptAsText = (
  text: string,
  fileName = "transcript.txt"
) => {
  const cleanedText = text.replace(/⏳ Transcribing...$/, "").trim();
  const blob = new Blob([cleanedText], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

export const downloadTranscriptAsPDF = async (
  text: string,
  fileName = "transcript.pdf"
): Promise<void> => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const doc: any = generateTranscriptPDF(text);
  const blob = await pdf(doc).toBlob();
  saveAs(blob, fileName);
};

export const handleDownload = (
  content: string,
  format: string,
  isDownloadDisabled: boolean
) => {
  if (isDownloadDisabled) return;

  if (format === "txt") {
    downloadTranscriptAsText(content);
  } else if (format === "pdf") {
    downloadTranscriptAsPDF(content);
  }
  // Add more formats if needed
};

export const getFileAccept = (isReader: boolean) => {
  const browser = detectBrowser();
  return browser === "firefox"
    ? isReader
      ? ACCEPTED_FILE_TYPES_FIREFOX
      : TRANSCRIBER_ACCEPTED_FILE_TYPES_FIREFOX
    : isReader
    ? ACCEPTED_FILE_TYPES
    : TRANSCRIBER_ACCEPTED_FILE_TYPES;
};

export function getSpeechModeKey(baseKey: string, isReader: boolean) {
  const prefix = isReader ? "gptr" : "gptt";
  return baseKey.replace(/^gptr|^gptt/, prefix);
}
