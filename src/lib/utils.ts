/* eslint-disable @typescript-eslint/no-explicit-any */
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { ACCEPTED_FILE_TYPES, ACCEPTED_FILE_TYPES_FIREFOX, BACKEND_URI, CHUNK_SIZE, CHUNK_TO_PAUSE_ON, DISCOUNT_PRICE_ANNUAL_ID, DISCOUNT_PRICE_ID, DOWLOAD_CHUNK_SIZE, SAFEST_MODEL, FIRST_DISCOUNT_PRICE_ANNUAL_ID, FIRST_DISCOUNT_PRICE_ID, FRAME_MS, LIFETIME_DEAL_ID, LISTENERS, LIVE_ANALYSER_WINDOW, LOCAL_LOGS, MATCH_URLS, MAX_SLIDER_VALUE, MIN_SILENCE_MS, MIN_SLIDER_VALUE, ORIGINAL_PRICE_ANNUAL_ID, ORIGINAL_PRICE_ID, PROMPT_INPUT_ID, REFRESH_MARGIN_MS, STEP_SLIDER_VALUE, TOAST_STYLE_CONFIG, TOAST_STYLE_CONFIG_INFO, TOKEN_TTL_MS, TRANSCRIBER_ACCEPTED_FILE_TYPES, TRANSCRIBER_ACCEPTED_FILE_TYPES_FIREFOX, MODELS_TO_WARN } from "./constants";
import { CheckoutPayloadType, FetchUserType, Product } from "@/pages/content/uploader/premium-modal";
import { toast, TOAST_REMOVE_DELAY } from "@/hooks/use-toast";
import { generateTranscriptPDF } from "../pages/content/uploader/previews/text-to-pdf";
import { pdf } from '@react-pdf/renderer';
import { saveAs } from 'file-saver';

export const getIsDarkMode = (): boolean => {
  try {
    if (typeof window === "undefined" || typeof document === "undefined") {
      // Background/service worker: pick a harmless default; you can also read chrome.storage here if you want.
      console.warn("getIsDarkMode: no window or document");
      return true;
    }

    const stored = window.localStorage.getItem("gptr/next-theme");
    if (stored === "dark") return true;
    if (stored === "light") return false;
    
    // If theme is "system" or not set, check system preference
    if (!stored || stored === "system") {
      return window.matchMedia?.("(prefers-color-scheme: dark)")?.matches ?? false;
    }

    // Don't read ChatGPT's page theme - use extension's own preference
    return false;
  } catch {
    return false;
  }
};
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
    if (!list.includes(chatId) && chatId) {
      writeChatsToDelete([...list, chatId]);
    }
};

/**
 * Check if the overlay is actually visible in the DOM
 * @returns true if overlay is open/visible, false otherwise
 */
export const isOverlayVisibleInDOM = (): boolean => {
  // Check for Radix Dialog with data-state="open"
  const dialogContent = document.querySelector('[role="dialog"][data-state="open"]');
  if (dialogContent) return true;
  
  // Also check for the shadow root container and dialog overlay/content
  const shadowRoot = document.querySelector('#__gpt-reader-shadow');
  if (shadowRoot) {
    const overlay = shadowRoot.querySelector('[data-radix-dialog-overlay]');
    const content = shadowRoot.querySelector('[data-radix-dialog-content]');
    if (overlay || content) return true;
  }
  
  return false;
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
      window.removeEventListener("PREPARE_RECEIVED", handler as any);
      resolve(e.detail);
    };
    window.addEventListener("PREPARE_RECEIVED", handler as any);
  });

//split text to small chunks
/**
 * Helper function to remove balanced brackets recursively
 */
function removeBalancedBrackets(text: string, openChar: string, closeChar: string): string {
  let result = '';
  let depth = 0;
  let i = 0;

  while (i < text.length) {
    const char = text[i];
    
    if (char === openChar) {
      depth++;
      i++;
      // Skip everything until we find the matching closing bracket
      while (i < text.length && depth > 0) {
        if (text[i] === openChar) {
          depth++;
        } else if (text[i] === closeChar) {
          depth--;
        }
        i++;
      }
    } else if (char === closeChar) {
      // Unmatched closing bracket, keep it
      result += char;
      i++;
    } else {
      result += char;
      i++;
    }
  }

  return result;
}

/**
 * Filters text for TTS conversion based on user settings.
 * Removes text in brackets and URLs if the corresponding settings are enabled.
 * The original text remains visible in the UI, but filtered text is used for TTS.
 * Returns both filtered text and a character mapping array where mapping[filteredIndex] = originalIndex
 */
export function filterTextForTTS(text: string): { filteredText: string; charMapping: number[] } {
  // Build character mapping by processing character-by-character
  const charMapping: number[] = [];
  let filtered = '';
  let originalIndex = 0;
  
  // Track which ranges to skip (brackets, URLs)
  const skipRanges: Array<{ start: number; end: number }> = [];
  
  // Check settings from localStorage (default to false if not set)
  const skipRoundBrackets = localStorage.getItem("gptr/skipRoundBrackets") === "true";
  const skipSquareBrackets = localStorage.getItem("gptr/skipSquareBrackets") === "true";
  const skipCurlyBrackets = localStorage.getItem("gptr/skipCurlyBrackets") === "true";
  const skipUrls = localStorage.getItem("gptr/skipUrls") === "true";

  // Find bracket ranges to skip
  if (skipRoundBrackets) {
    findBracketRanges(text, '(', ')', skipRanges);
  }
  if (skipSquareBrackets) {
    findBracketRanges(text, '[', ']', skipRanges);
  }
  if (skipCurlyBrackets) {
    findBracketRanges(text, '{', '}', skipRanges);
  }

  // Find URL ranges to skip
  if (skipUrls) {
    const commonTLDs = [
      'com', 'org', 'net', 'edu', 'gov', 'mil', 'int',
      'io', 'co', 'uk', 'ca', 'au', 'de', 'fr', 'jp', 'cn', 'in', 'br', 'ru', 'es', 'it', 'nl', 'se', 'no', 'dk', 'fi', 'pl', 'cz', 'ie', 'nz', 'sg', 'hk', 'tw', 'kr', 'mx', 'ar', 'za', 'tr', 'id', 'th', 'vn', 'ph', 'my', 'ae', 'sa', 'il', 'gr', 'pt', 'be', 'ch', 'at', 'ro', 'hu', 'bg', 'hr', 'sk', 'si', 'ee', 'lv', 'lt', 'is', 'lu', 'mt', 'cy',
      'app', 'dev', 'tech', 'online', 'site', 'website', 'info', 'biz', 'name', 'pro', 'xyz', 'me', 'tv', 'cc', 'ws', 'mobi', 'asia', 'jobs', 'travel', 'store', 'shop', 'blog', 'news', 'media', 'email', 'cloud', 'ai', 'io'
    ].join('|');
    
    const urlRegex = new RegExp(
      `(https?:\\/\\/[^\\s]+|ftp:\\/\\/[^\\s]+|www\\.[^\\s]+|[a-zA-Z0-9-]+\\.(?:${commonTLDs})(?:[^\\s]*)?)`,
      'gi'
    );
    
    let match;
    while ((match = urlRegex.exec(text)) !== null) {
      skipRanges.push({ start: match.index, end: match.index + match[0].length });
      // Safety: prevent infinite loop on zero-length matches
      if (match.index === urlRegex.lastIndex) {
        urlRegex.lastIndex++;
      }
    }
  }

  // Find copyright phrases to skip (case-insensitive)
  const copyrightPhrases = [
    '©',
    '℗',
    '®',
    '™',
    '℠',
    'Pat.',
    '№',
    '(c)',
    'Copyright',
    'All rights reserved',
    'Some rights reserved',
    'No rights reserved',
    'No part of this work may be reproduced',
    'No part of this publication may be reproduced',
    'May not be reproduced',
    'Reproduction prohibited',
    'Unauthorized reproduction prohibited',
    'Do not copy',
    'Copying prohibited',
    'No copying',
    'No reproduction',
    'No redistribution',
    'Redistribution prohibited',
    'No republication',
    'Republication prohibited',
    'Not for distribution',
    'For personal use only',
    'Noncommercial use only',
    'Commercial use prohibited',
    'Permission required',
    'Permission granted',
    'Used with permission',
    'Reprinted with permission',
    'Reproduced with permission',
    'Licensed content',
    'Licensed material',
    'Rights reserved',
    'Protected by copyright',
    'Protected by copyright law',
    'This material is protected by copyright',
    'DMCA',
    'Digital Millennium Copyright Act',
    'Takedown notice'
  ];

  // Create regex pattern that matches phrases (case-insensitive)
  // Match phrases even when they're part of larger text (no word boundaries)
  for (const phrase of copyrightPhrases) {
    // Escape special regex characters
    const escapedPhrase = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // Match the phrase directly without word boundaries so it can be removed even when attached to other text
    const regex = new RegExp(escapedPhrase, 'gi');
    let match;
    while ((match = regex.exec(text)) !== null) {
      skipRanges.push({ start: match.index, end: match.index + match[0].length });
      // Safety: prevent infinite loop on zero-length matches
      if (match.index === regex.lastIndex) {
        regex.lastIndex++;
      }
    }
  }

  // Sort skip ranges by start position
  skipRanges.sort((a, b) => a.start - b.start);

  // Merge overlapping ranges
  const mergedRanges: Array<{ start: number; end: number }> = [];
  for (const range of skipRanges) {
    if (mergedRanges.length === 0 || mergedRanges[mergedRanges.length - 1].end < range.start) {
      mergedRanges.push({ ...range });
    } else {
      mergedRanges[mergedRanges.length - 1].end = Math.max(
        mergedRanges[mergedRanges.length - 1].end,
        range.end
      );
    }
  }

  // Process text character by character, building filtered text and mapping
  // For very large texts, process in batches to avoid stack overflow
  let rangeIndex = 0;
  
  // Process in batches and periodically flush to avoid excessive memory usage
  const BATCH_SIZE = 5000;
  let batchCount = 0;
  
  for (let i = 0; i < text.length; i++) {
    // Check if we're in a skip range
    while (rangeIndex < mergedRanges.length && mergedRanges[rangeIndex].end <= i) {
      rangeIndex++;
    }
    
    const inSkipRange = rangeIndex < mergedRanges.length && 
                        i >= mergedRanges[rangeIndex].start && 
                        i < mergedRanges[rangeIndex].end;
    
    if (!inSkipRange) {
      filtered += text[i];
      charMapping.push(i);
      batchCount++;
    }
    
    // Yield periodically for very large texts to prevent blocking
    if (batchCount >= BATCH_SIZE && i % BATCH_SIZE === 0 && i > 0) {
      // Use setTimeout to yield control and prevent stack overflow
      // But we need this to be synchronous, so we'll just continue
      // The batching helps prevent excessive array growth
      batchCount = 0;
    }
  }

  // Clean up multiple spaces
  const beforeCleanup = filtered;
  filtered = filtered.replace(/\s+/g, ' ').trim();
  
  // Rebuild mapping after space cleanup
  if (filtered !== beforeCleanup) {
    rebuildMappingAfterSpaceCleanup(charMapping, beforeCleanup, filtered);
  }

  return { filteredText: filtered, charMapping };
}

/**
 * Finds all bracket ranges in text
 */
function findBracketRanges(
  text: string,
  openChar: string,
  closeChar: string,
  ranges: Array<{ start: number; end: number }>
): void {
  let depth = 0;
  let bracketStart = -1;
  
  for (let i = 0; i < text.length; i++) {
    if (text[i] === openChar) {
      if (depth === 0) bracketStart = i;
      depth++;
    } else if (text[i] === closeChar) {
      depth--;
      if (depth === 0 && bracketStart >= 0) {
        ranges.push({ start: bracketStart, end: i + 1 });
        bracketStart = -1;
      }
    }
  }
}

/**
 * Rebuilds character mapping after space cleanup
 */
function rebuildMappingAfterSpaceCleanup(
  charMapping: number[],
  beforeText: string,
  afterText: string
): void {
  const newMapping: number[] = [];
  let beforeIdx = 0;
  let afterIdx = 0;
  let inWhitespace = false;
  
  while (beforeIdx < beforeText.length && afterIdx < afterText.length) {
    const beforeChar = beforeText[beforeIdx];
    const afterChar = afterText[afterIdx];
    const isWhitespace = /\s/.test(beforeChar);
    
    if (isWhitespace) {
      if (!inWhitespace && afterChar === ' ') {
        // First whitespace becomes a single space
        if (beforeIdx < charMapping.length) {
          newMapping.push(charMapping[beforeIdx]);
        }
        afterIdx++;
        inWhitespace = true;
      }
      beforeIdx++;
    } else {
      if (beforeChar === afterChar) {
        if (beforeIdx < charMapping.length) {
          newMapping.push(charMapping[beforeIdx]);
        }
        beforeIdx++;
        afterIdx++;
        inWhitespace = false;
      } else {
        beforeIdx++;
      }
    }
  }
  
  // Handle trim - map remaining characters
  while (newMapping.length < afterText.length && charMapping.length > newMapping.length) {
    const remainingIdx = newMapping.length;
    if (remainingIdx < charMapping.length) {
      newMapping.push(charMapping[remainingIdx]);
    } else {
      break;
    }
  }
  
  // Replace mapping without using spread operator (which causes stack overflow with large arrays)
  charMapping.length = 0;
  // Use push with apply in chunks to avoid stack overflow
  const CHUNK_SIZE = 10000;
  for (let i = 0; i < newMapping.length; i += CHUNK_SIZE) {
    const chunk = newMapping.slice(i, i + CHUNK_SIZE);
    for (let j = 0; j < chunk.length; j++) {
      charMapping.push(chunk[j]);
    }
  }
}

/**
 * Terminal punctuation: Unicode characters that mark end of sentences/clauses.
 * Uses \p{Terminal_Punctuation} so it works across scripts (Latin, CJK, Arabic, Devanagari, Thai, Khmer, etc.).
 * Includes comma, period, colon, semicolon, and script-specific equivalents.
 */
const BREAK_AT_TERMINAL_PUNCT = /\p{Terminal_Punctuation}/u;

/**
 * Whitespace characters for fallback splitting.
 */
const BREAK_AT_SPACE = /\s/u;

const LOOKAHEAD_MIN = 100;
const LOOKAHEAD_MAX = 500;

/**
 * Find the next break point, preferring terminal punctuation.
 * - First looks for terminal punctuation within the next 25% of targetSize characters (min 100, max 500)
 * - If none found, falls back to the closest space within LOOKAHEAD_MIN (100) chars
 * - If no space in that window, breaks at 100 chars (mid-word) as a safety
 * - Returns text.length if no break found
 */
function findNextBreak(text: string, from: number, targetSize: number): number {
  const lookAheadAmount = Math.max(
    LOOKAHEAD_MIN,
    Math.min(LOOKAHEAD_MAX, Math.floor(targetSize * 0.25))
  );
  const lookAheadLimit = from + lookAheadAmount;
  const searchEnd = Math.min(lookAheadLimit, text.length);
  
  // First, look for terminal punctuation within the lookahead window
  for (let i = from; i < searchEnd; i++) {
    if (BREAK_AT_TERMINAL_PUNCT.test(text[i])) return i;
  }
  
  // Fall back to space, but only within LOOKAHEAD_MIN chars; otherwise break mid-word
  const spaceSearchEnd = Math.min(from + LOOKAHEAD_MIN, text.length);
  for (let i = from; i < spaceSearchEnd; i++) {
    if (BREAK_AT_SPACE.test(text[i])) return i;
  }
  return spaceSearchEnd;
}

const MAX_CHUNK_SIZE = 3500;

export function splitIntoChunksV2(text: string, chunkSize: number = CHUNK_SIZE): Chunk[] {
  const initialChunkSize = Math.max(1, Math.floor(chunkSize));
  let targetSize = initialChunkSize;
  const chunks: Chunk[] = [];
  let start = 0;
  let chunkId = 0;

  while (start < text.length) {
    const end = start + targetSize;

    if (end >= text.length) {
      const slice = text.slice(start).trim();
      if (slice.length > 0) {
        chunks.push({ id: `${chunkId++}`, text: slice, completed: false });
      }
      break;
    }

    // Landed at or past targetSize; might be mid-word. Find next safe break:
    // Prefers terminal punctuation within next 25% of targetSize, falls back to space if none found.
    const breakIndex = findNextBreak(text, end, targetSize);
    const chunkText = text.slice(start, breakIndex + 1).trim();
    if (chunkText.length > 0) {
      chunks.push({ id: `${chunkId++}`, text: chunkText, completed: false });
      // Pacing: every CHUNK_TO_PAUSE_ON chunks reset targetSize; otherwise grow by 1.25x up to max.
      const isEveryNthChunk = (chunkId % CHUNK_TO_PAUSE_ON) === 0;
      if (isEveryNthChunk) {
        targetSize = initialChunkSize;
      } else {
        targetSize = Math.min(Math.floor(targetSize * 1.25), MAX_CHUNK_SIZE);
      }
    }
    start = breakIndex + 1;
  }

  return chunks;
}

export function normalizeAlphaNumeric(str: string) {
  // This will keep all Unicode letters and digits
  return str.replace(/[^\p{L}\p{N}]/gu, "").toLowerCase();
}

export const maybeDeleteChat = async (chatId: string) => {
    try {
        const res = await deleteChatAndCreateNew(false, chatId);
        if (res?.ok) {
            removeChatFromDeleteLS(chatId);
        } else {
            addChatToDeleteLS(chatId);
        }
    } catch {
        addChatToDeleteLS(chatId);
    }
};

export async function fetchAndStoreTopChat() {
  const LS_KEY = "gptr/top-chat";

  try {
    // Wait for auth token using the same pattern as other functions
    const token = await waitForAuthToken(10000); // 10 second timeout
    if (!token) {
      console.error("[fetchAndStoreTopChat] Missing access token");
      return;
    }

    const res = await fetchWithTokenRefresh(
      "https://chatgpt.com/backend-api/conversations?offset=0&limit=1&order=updated&is_archived=false&is_starred=false",
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
      },
      token
    );

    if (!res.ok) {
      console.error("[fetchAndStoreTopChat] Failed to fetch:", res.status);
      return;
    }

    const data = await res.json();
    const topChatId = data?.items?.[0]?.id;

    if (topChatId) {
      localStorage.setItem(LS_KEY, topChatId);
      if (LOCAL_LOGS) console.log("[fetchAndStoreTopChat] Stored top chat ID:", topChatId);
      return topChatId;
    } else {
      console.warn("[fetchAndStoreTopChat] No chat items found");
    }
  } catch (err) {
    console.error("[fetchAndStoreTopChat] Error fetching chat:", err);
  }
}

export async function collectChatsAboveTopChat(deleteFlag: boolean = true) {
  const LS_TOP_KEY = "gptr/top-chat";
  const LS_DELETE_KEY = "gptr/chatsToDelete";

  const topChatId = localStorage.getItem(LS_TOP_KEY);
  if (!topChatId) {
    console.warn("[collectChatsAboveTopChat] No top chat stored yet.");
    return;
  }

  try {
    // Wait for auth token using the same pattern as other functions
    const token = await waitForAuthToken(10000); // 10 second timeout
    if (!token) {
      console.error("[collectChatsAboveTopChat] Missing access token");
      if (deleteFlag) localStorage.removeItem(LS_TOP_KEY);
      return;
    }

    const res = await fetchWithTokenRefresh(
      "https://chatgpt.com/backend-api/conversations?offset=0&limit=28&order=updated&is_archived=false&is_starred=false",
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
      },
      token
    );

    if (!res.ok) {
      console.error("[collectChatsAboveTopChat] Fetch failed:", res.status);
      if (deleteFlag) localStorage.removeItem(LS_TOP_KEY);
      return;
    }

    const data = await res.json();
    const items: { id: string }[] = data?.items ?? [];
    if (!items.length) {
      console.warn("[collectChatsAboveTopChat] No conversations found.");
      if (deleteFlag) localStorage.removeItem(LS_TOP_KEY);
      return;
    }

    const topIndex = items.findIndex(item => item.id === topChatId);
    if (topIndex === -1) {
      console.warn("[collectChatsAboveTopChat] Top chat not found in response.");
      if (deleteFlag) localStorage.removeItem(LS_TOP_KEY);
      return;
    }

    // All conversations above (newer) than topChatId
    const idsToDelete = items.slice(0, topIndex).map(item => item.id);

    if (idsToDelete.length) {
      const existing = JSON.parse(localStorage.getItem(LS_DELETE_KEY) || "[]");
      const merged = Array.from(new Set([...existing, ...idsToDelete]));
      localStorage.setItem(LS_DELETE_KEY, JSON.stringify(merged));
      if (LOCAL_LOGS) console.log("[collectChatsAboveTopChat] Added chats to delete list:", idsToDelete);
    } else {
      if (LOCAL_LOGS) console.log("[collectChatsAboveTopChat] No newer chats found above top chat.");
    }

    if (deleteFlag) localStorage.removeItem(LS_TOP_KEY);
  } catch (err) {
    console.error("[collectChatsAboveTopChat] Error fetching chats:", err);
    if (deleteFlag) localStorage.removeItem(LS_TOP_KEY);
  }
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

  try {
    // Wait for auth token using the same pattern as other functions
    const token = await waitForAuthToken(10000); // 10 second timeout
    if (!token) {
      console.error("Failed to delete chat: no token");
      return;
    }

    const response = await fetchWithTokenRefresh(
      `https://chatgpt.com/backend-api/conversation/${storedChatId}`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({ is_visible: false }),
      },
      token
    );

    if (createChat) {
      const newChatBtn = document.querySelector<HTMLButtonElement>(
        "[data-testid='create-new-chat-button'], [aria-label='New chat']"
      );
      newChatBtn?.click();
    }

    return response;
  } catch (err) {
    console.error("Failed to delete chat:", err);
  }
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
  // First, check for ChatGPT tabs in the current active window
  const currentWindowTabs = await chrome.tabs.query({ url: MATCH_URLS, currentWindow: true });
  if (currentWindowTabs.length > 0 && currentWindowTabs[0].id) {
    await chrome.tabs.update(currentWindowTabs[0].id, { active: true });
    return currentWindowTabs[0].id;
  }

  // If no ChatGPT tab in current window, create a new one in the active window
  const tab = await chrome.tabs.create({ url: `https://chatgpt.com/` });
  if (tab.id) {
    await chrome.tabs.update(tab.id, { active: true });
    return tab.id + "::new_tab";
  }
  return
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

export const isPremium = () => {
  // Check for span with only "Plus" text
  const plusSpan = Array.from(document.querySelectorAll('span')).find(
    (span) => span.textContent?.trim() === "Plus"
  );
  if (plusSpan) {
    return true;
  }
  
  // Fallback to original method for backwards compatibility
  const plusDiv = document.querySelector('div.truncate[dir="auto"]');
  if (plusDiv && plusDiv.textContent.trim() === "Plus") {
    return true;
  }
  
  return false;
}

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

export const isBadModel = () => {
  if (!isPremium()) return false
  if (document.querySelector('button[id^="radix-_r_56_"]')) {
    return true;
  }
  const isNotSupportedModel = (models: string | string[]) => MODELS_TO_WARN.some((model) => models.includes(model));
  // if the user has not used a model before, check if the model switcher is present on the dom
  const modelSwitcher = document.querySelector('[data-testid="model-switcher-dropdown-button"]') as HTMLButtonElement;
  if (modelSwitcher) {
    const ariaLabel = modelSwitcher.getAttribute("aria-label") || "";
    if (!ariaLabel.toLowerCase().includes("instant") && localStorage.getItem("gptr/badModel") !== "true") {
      localStorage.setItem("gptr/badModel", "true");
      return true;
    }
    if (ariaLabel.toLowerCase().includes("thinking")) {
      return true;
    }
    return isNotSupportedModel(modelSwitcher.innerHTML);
  }
  return false
};

export const choosePreferredModel = async () => {
  // only for premium users
  if (!isPremium()) {
    if (LOCAL_LOGS) console.log("[choosePreferredModel] Not a plus user");
    return true;
  }
  // ─────────────────────────────────────────────────────────────
  // Call user_last_used_model_config with retries (best-effort)
  // Keep early-returns above intact (non-plus / already instant).
  // ─────────────────────────────────────────────────────────────
  const callLastUsedModelConfig = async () => {
    // Wait for auth token using the same pattern as other functions
    const token = await waitForAuthToken(10000); // 10 second timeout
    if (!token) {
      if (LOCAL_LOGS) console.warn("[choosePreferredModel] No auth token; skipping last_used_model_config call");
      return;
    }
    const url =
      `https://chatgpt.com/backend-api/settings/user_last_used_model_config?model_slug=${SAFEST_MODEL}`;
    const maxAttempts = 3;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const res = await fetchWithTokenRefresh(
          url,
          {
            method: "PATCH",
            headers: { Authorization: `Bearer ${token}` },
          },
          token
        );
        if (res.ok) {
          // parse defensively and ignore contents
          try { await res.json(); } catch {}
          if (LOCAL_LOGS) console.log("[choosePreferredModel] last_used_model_config succeeded");
          return;
        }
        throw new Error(`HTTP ${res.status}`);
      } catch (err) {
        if (attempt === maxAttempts) {
          console.warn("[choosePreferredModel] last_used_model_config failed after 3 attempts:", err);
          return;
        }
        await new Promise(r => setTimeout(r, 300 * attempt)); // light backoff
      }
    }
  };
  await callLastUsedModelConfig();
};

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

// Deprecated: Use details?.isLifetime from getSubscriptionDetails() instead
// Keeping for backward compatibility but prefer using the API field
export function isLifetimePriceId(id?: string | null): boolean {
  if (!id) return false;
  return id === LIFETIME_DEAL_ID;
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
    // Don't overwrite extension theme when restoring ChatGPT's page state
  } catch (err) {
    console.error("Could not parse saved root info:", err);
  }
}


async function waitForStorageKey<T>(
  key: string,
  storageArea: "sync" | "local" = "sync",
  timeoutMs = 3000,
  intervalMs = 100
): Promise<T | null> {
  // If we're looking for openaiId, ensure auth flow has completed to store it
  if (key === "openaiId") {
    // First, do a quick check if it already exists
    const quickCheck = await new Promise<T | null>((resolve) => {
      chrome.storage[storageArea].get(key, (res) => {
        resolve(res[key] || null);
      });
    });
    
    if (quickCheck) {
      return quickCheck;
    }
    
    try {
      const tabs = await getGPTTabs();
      if (tabs && tabs.length > 0 && tabs[0].id) {
        // Inject script into page context to dispatch GET_TOKEN event
        chrome.scripting.executeScript({
          target: { tabId: tabs[0].id },
          func: () => {
            window.dispatchEvent(new Event("GET_TOKEN"));
          }
        }).catch(() => {
          // Ignore errors - tab might not be ready or scripting API not available
        });
      }
    } catch (e) {
      // Ignore errors - just continue with polling
    }
    
    // Increase timeout for openaiId since we're waiting for auth flow to complete
    timeoutMs = 10000; // To allow auth flow to complete
  }
  
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
    // Clear subscription caches when checkout session is created
    // Wrap in Promise to ensure it completes before redirect
    await new Promise<void>((resolve) => {
      chrome.storage.local.remove(
        [
          "subscriptionDetailsLastFetchedTime",
          "subscriptionDetails",
        ],
        () => resolve()
      );
    });
    
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

export const cancelSubscription = async (subscriptionId: string, cancel?: boolean) => {
  try {
    const url = cancel !== undefined 
      ? `${BACKEND_URI}/gpt-reader/cancel-subscription?subscriptionId=${subscriptionId}&cancel=${cancel}`
      : `${BACKEND_URI}/gpt-reader/cancel-subscription?subscriptionId=${subscriptionId}`;
    const res = await secureFetch(url, { method: "DELETE" });
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
  isLifetime: boolean;
} | null> => {
  try {
    // Check cache first (1 hour or until currentPeriodEnd, whichever is shorter)
    const cached = await chrome.storage.local.get(["subscriptionDetails", "subscriptionDetailsLastFetchedTime"]);
    const now = Date.now();
    const OneHoursMs = 1 * 60 * 60 * 1000;
    
    if (cached.subscriptionDetails && cached.subscriptionDetailsLastFetchedTime) {
      // Determine cache duration: use currentPeriodEnd if it's less than 1 hour away, otherwise 1 hour
      let cacheDurationMs = OneHoursMs;
      if (cached.subscriptionDetails.currentPeriodEnd && typeof cached.subscriptionDetails.currentPeriodEnd === 'number') {
        const timeUntilPeriodEnd = cached.subscriptionDetails.currentPeriodEnd - now;
        if (timeUntilPeriodEnd > 0 && timeUntilPeriodEnd < OneHoursMs) {
          cacheDurationMs = timeUntilPeriodEnd;
        }
      }
      
      if ((now - cached.subscriptionDetailsLastFetchedTime) < cacheDurationMs) {
        return cached.subscriptionDetails;
      }
    }

    const openaiId = await waitForStorageKey<string>("openaiId", "sync");
    if (!openaiId) return null;
    
    const data = await secureFetch(
      `${BACKEND_URI}/gpt-reader/subscription-details?openaiId=${openaiId}`,
      { method: "GET" }
    );
    
    // Cache the result
    if (data) {
      await chrome.storage.local.set({
        subscriptionDetails: data,
        subscriptionDetailsLastFetchedTime: now,
      });
    }
    
    return data;
  } catch {
    return null;
  }
};

/**
 * Resolve the user's Stripe subscriptionId, preferring the cached value in
 * chrome.storage.local. If it's missing (e.g. after extension reinstall, cache
 * eviction, or a fresh sign-in), fall back to fetching subscription-details
 * from the backend and persist the result. Returns null only if the user has
 * no active subscription. Use this everywhere instead of reading
 * `subscriptionId` directly so cancel/switch endpoints never fire with
 * `subscriptionId=undefined`.
 */
export async function ensureSubscriptionId(): Promise<string | null> {
  const stored = await getStoredValue<string>("subscriptionId", "local");
  if (stored) return stored;

  let details: { subscriptionId: string | null } | null = null;
  if (detectBrowser() === "firefox") {
    details = await new Promise((resolve) =>
      chrome.runtime.sendMessage(
        { type: "GET_SUBSCRIPTION_DETAILS" },
        (r) => resolve(r ?? null)
      )
    );
  } else {
    details = await getSubscriptionDetails();
  }

  const id = details?.subscriptionId ?? null;
  if (id) await chrome.storage.local.set({ subscriptionId: id });
  return id;
}

export const switchSubscriptionToPrice = async (
  subscriptionId: string,
  priceId: string
): Promise<{
  subscriptionId: string;
  currentPriceId: string | null;
  currentPeriodEnd: number | null;
}> => {
  // Clear subscription caches when subscription is switched
  // Wrap in Promise to ensure it completes before redirect
  await new Promise<void>((resolve) => {
    chrome.storage.local.remove(
      [
        "subscriptionDetailsLastFetchedTime",
        "subscriptionDetails",
      ],
      () => resolve()
    );
  });
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

// Type declaration for window property
declare global {
  interface Window {
    __gptReaderCachedToken?: string;
  }
}

// Utility to wait for auth token to be available
// Helper function to invalidate token cache and get fresh token
async function invalidateAndRefreshToken(): Promise<string | null> {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent("TOKEN_EXPIRED"));
    // Clear cached token
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.remove(["gptr/cachedSessionToken", "gptr/cachedSessionExpiry"]).catch(() => {});
    }
    try {
      localStorage.removeItem("gptr/cachedSessionToken");
      localStorage.removeItem("gptr/cachedSessionExpiry");
    } catch {}
    (window as any).__gptReaderCachedToken = null;
  }
  // Get fresh token
  return await waitForAuthToken(10000);
}

// Helper function to handle 401/403 and retry a fetch call
async function fetchWithTokenRefresh(
  url: string,
  options: RequestInit,
  token: string
): Promise<Response> {
  let response = await fetch(url, options);
  
  // Handle 401/403 - token expired, refresh and retry
  if (response.status === 401 || response.status === 403) {
    console.warn(`[fetchWithTokenRefresh] Token expired (${response.status}) for ${url}, refreshing token and retrying`);
    const freshToken = await invalidateAndRefreshToken();
    if (!freshToken) {
      throw new Error("Failed to get fresh token after 401/403");
    }
    // Retry with fresh token
    const newOptions = {
      ...options,
      headers: {
        ...options.headers,
        Authorization: `Bearer ${freshToken}`,
      },
    };
    response = await fetch(url, newOptions);
  }
  
  return response;
}

export async function waitForAuthToken(timeout = 30000): Promise<string | null> {
  // First check if token is already available in window
  if (window.__gptReaderCachedToken) {
    return window.__gptReaderCachedToken;
  }

  // Check chrome.storage.local for cached token (if available)
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    try {
      const stored = await chrome.storage.local.get(["gptr/cachedSessionToken", "gptr/cachedSessionExpiry"]);
      if (stored["gptr/cachedSessionToken"]?.accessToken && 
          stored["gptr/cachedSessionExpiry"] && 
          Date.now() < stored["gptr/cachedSessionExpiry"]) {
        const token = stored["gptr/cachedSessionToken"].accessToken;
        window.__gptReaderCachedToken = token;
        return token;
      }
    } catch (e) {
      console.warn("Failed to check chrome.storage.local for token:", e);
    }
  }
  
  // Check localStorage as fallback (available in page context)
  try {
    const storedToken = localStorage.getItem("gptr/cachedSessionToken");
    const storedExpiry = localStorage.getItem("gptr/cachedSessionExpiry");
    if (storedToken && storedExpiry && Date.now() < Number(storedExpiry)) {
      const tokenData = JSON.parse(storedToken);
      const token = tokenData.accessToken;
      window.__gptReaderCachedToken = token;
      return token;
    }
  } catch (e) {
    console.warn("Failed to check localStorage for token:", e);
  }

  // Dispatch GET_TOKEN and wait for AUTH_RECEIVED
  return new Promise((resolve) => {
    const handler = (e: Event) => {
      const ce = e as CustomEvent<{ accessToken: string }>;
      window.removeEventListener("AUTH_RECEIVED", handler);
      resolve(ce.detail?.accessToken || null);
    };
    window.addEventListener("AUTH_RECEIVED", handler, { once: true });
    window.dispatchEvent(new Event("GET_TOKEN"));
    
    // Timeout after specified duration
    setTimeout(() => {
      window.removeEventListener("AUTH_RECEIVED", handler);
      resolve(null);
    }, timeout);
  });
}

export async function transcribeWithFallback(
  blob: Blob,
  label: string,
  depth = 0,
  token: string | null,
  audioCtx: AudioContext
): Promise<string> {
  // Wait for token if not provided
  if (!token) {
    token = await waitForAuthToken();
    if (!token) {
      throw new Error("Authentication token not available");
    }
  }
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
    const res = await fetchWithTokenRefresh(
      "https://chatgpt.com/backend-api/transcribe",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      },
      token
    );

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
  // Firefox supports DOCX, EPUB, and TXT (PDF not supported due to browser restrictions)
  if (browser === "firefox") {
    return isReader
      ? ACCEPTED_FILE_TYPES_FIREFOX
      : TRANSCRIBER_ACCEPTED_FILE_TYPES_FIREFOX;
  }
  // Chrome and other browsers
  return isReader
    ? ACCEPTED_FILE_TYPES
    : TRANSCRIBER_ACCEPTED_FILE_TYPES;
};

export function getSpeechModeKey(baseKey: string, isReader: boolean) {
  const prefix = isReader ? "gptr" : "gptt";
  return baseKey.replace(/^gptr|^gptt/, prefix);
}
