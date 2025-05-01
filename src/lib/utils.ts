import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { CHUNK_SIZE, DOWLOAD_CHUNK_SIZE, LISTENERS, MATCH_URLS, MAX_SLIDER_VALUE, MIN_SLIDER_VALUE, STEP_SLIDER_VALUE } from "./constants";

export type Chunk = { id: string; text: string, messageId?: string, completed: boolean, isPlaying?: boolean };

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
      const isEvery9thChunk = (chunkId % 9) === 0;

      // Adjust the target size based on conditions
      if (isEvery9thChunk) {
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

export function splitIntoChunksV1(text: string, chunkSize: number = DOWLOAD_CHUNK_SIZE): Chunk[] {
  const sentences = text.match(/(?:[^.!?•]+[.!?•]+[\])'"`’”]*|[^.!?•]+(?:$))/g) || []; //matches sentences based on the delimiters
  let currentChunk = "";
  let chunkId = 0;

  return sentences.reduce((chunks, sentence, i, arr) => {
    const isCurrentChunkSizeGreaterThanOrEqualChunkSize = (currentChunk + sentence).length >= chunkSize;
    const isEnd = i === arr.length-1
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
    const tab = await chrome.tabs.create({ url: "https://chatgpt.com" });
    if(tab.id){
        await chrome.tabs.update(tab.id, { active: true });
        return tab.id +"::new_tab";
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
