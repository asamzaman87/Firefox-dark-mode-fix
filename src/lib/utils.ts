/* eslint-disable @typescript-eslint/no-explicit-any */
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { BACKEND_URI, CHUNK_SIZE, CHUNK_TO_PAUSE_ON, DOWLOAD_CHUNK_SIZE, LISTENERS, MATCH_URLS, MAX_SLIDER_VALUE, MIN_SLIDER_VALUE, REFRESH_MARGIN_MS, STEP_SLIDER_VALUE, TOAST_STYLE_CONFIG, TOKEN_TTL_MS } from "./constants";
import { CheckoutPayloadType, FetchUserType, Product } from "@/pages/content/uploader/premium-modal";
import { toast, TOAST_REMOVE_DELAY } from "@/hooks/use-toast";

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
  // Split the text into sentences based on common delimiters
  const sentences = text.match(/(?:[^.!?•]+[.!?•]+[\])'"`’”]*|[^.!?•]+(?:$))/g) || [];
  // const sentences = text.match(/[^.!?]+[.!?]+[\])'"`’”]*|.+/g) || [];
  let currentChunk = "";
  let chunkId = 0;

  const initialChunkSize = chunkSize; // Initial chunk size in characters
  let targetSize = initialChunkSize;   // Current target chunk size
  const maxChunkSize = 4000;           // Maximum chunk size in characters

  const chunks = sentences.reduce((chunks, sentence, i, arr) => {
    // Calculate the potential new chunk if the current sentence is added
    const potentialChunk = currentChunk ? currentChunk + ' ' + sentence.trim() : sentence.trim();
    const potentialSize = potentialChunk.length;

    const isCurrentChunkSizeGreaterThanOrEqualTargetSize = potentialSize >= targetSize;
    const isEnd = i === arr.length - 1; // Check if it's the last sentence

    if (isCurrentChunkSizeGreaterThanOrEqualTargetSize) {
      // Push the current chunk to the chunks array if it's not empty
      if (currentChunk.trim().length > 0) {
        chunks.push({ id: `${chunkId++}`, text: currentChunk.trim(), completed: false });
      }

      // Start a new chunk with the current sentence
      currentChunk = sentence.trim();

      // Determine if the next chunk should reset based on chunkId
      const isEveryNthChunk = (chunkId % CHUNK_TO_PAUSE_ON) === 0;

      // Adjust the target size based on conditions
      if (isEveryNthChunk) {
        // Reset to the initial chunk size
        targetSize = initialChunkSize;
      } else {
        // Increase the target size by 50%, ensuring it does not exceed maxChunkSize
        targetSize = Math.min(Math.floor(targetSize * 1.5), maxChunkSize);
      }
    } else {
      // Accumulate the sentence into the current chunk
      currentChunk = potentialChunk;
    }

    // If it's the last sentence, we need to ensure the last chunk is pushed
    if (isEnd) {
      // Always push the last chunk if it has content
      if (currentChunk.trim().length > 0) {
        chunks.push({ id: `${chunkId}`, text: currentChunk.trim(), completed: false });
      }
    }

    return chunks;
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

function waitForStorageKey<T>(
  key: string,
  storageArea: "sync" | "local" = "sync",
  timeoutMs = 3000
): Promise<T | null> {
  return new Promise((resolve) => {
    let timer: number;
    chrome.storage[storageArea].get(key, res => {
      if (res[key] != null) {
        clearTimeout(timer);
        return resolve(res[key]);
      }
      const listener = (
        changes: Record<string, chrome.storage.StorageChange>,
        area: string
      ) => {
        if (area === storageArea && changes[key]?.newValue != null) {
          clearTimeout(timer);
          chrome.storage.onChanged.removeListener(listener);
          resolve(changes[key].newValue);
        }
      };
      chrome.storage.onChanged.addListener(listener);
      timer = window.setTimeout(() => {
        chrome.storage.onChanged.removeListener(listener);
        resolve(null);
      }, timeoutMs);
    });
  });
}



export const handleCheckUserSubscription = async () => {
  try {
    const openaiId = await waitForStorageKey<string>("openaiId", "sync");

    if (!openaiId) {
      chrome.storage.local.set({ hasSubscription: true });
      return true;
    }

    const data: {
      hasSubscription: boolean;
      subscriptionId: string;
      isSubscriptionCancelled: boolean;
      currentPeriodEnd: number;
    } = await secureFetch(
      `${BACKEND_URI}/gpt-reader/check-subscription?openaiId=${openaiId}`
    );
    chrome.storage.local.set({
      hasSubscription: data?.hasSubscription || false,
      subscriptionId: data.subscriptionId,
      isSubscriptionCancelled: data.isSubscriptionCancelled || false,
      currentPeriodEnd: data.currentPeriodEnd,
    });
    return data.hasSubscription || false;
  } catch (err) {
    console.error("Error checking subscription:", err);
    //! HIGHLY CRITICAL CASE: ✅ Fallback to true if Vercel/API is down
    chrome.storage.local.set({
      hasSubscription: true,
      subscriptionId: null,
      isSubscriptionCancelled: false,
      currentPeriodEnd: null,
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
      {
        method: "POST",
        body: JSON.stringify(payload),
      }
    );
    return data?.session ?? null;
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
    if (!error.includes("1500")) toast({ description: error, style: TOAST_STYLE_CONFIG, duration });
    return
}