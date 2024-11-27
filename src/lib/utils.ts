import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { CHUNK_SIZE, LISTENERS } from "./constants";

export type Chunk = { id: string; text: string, messageId?: string, completed: boolean, isPlaying?: boolean };

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

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

/**
 * @deprecated use splitIntoChunksV2
 */
export function splitIntoChunks(text: string, chunkSize: number = CHUNK_SIZE): Chunk[] {
  // Split the text into words by using spaces as delimiters
  return text.split(" ").reduce((chunks, word, index) => {
    // Determine the current chunk index based on word position and chunk size
    const i = Math.floor(index / chunkSize);

    // If the chunk exists, append the word with a space; otherwise, start a new chunk
    const text = (chunks[i] ? `${chunks[i].text} ` : "") + word;
    chunks[i] = { id: `${i}`, text, completed: false };


    // Return the updated chunks array after adding each word
    return chunks;
  }, [] as Chunk[]); // Initialize an empty array for the chunks
}

export function splitIntoChunksV2(text: string, chunkSize: number = CHUNK_SIZE): Chunk[] {
  // Split the text into sentences based on common delimiters
  const sentences = text.match(/[^.!?]+[.!?]+[\])'"`’”]*|.+/g) || [];
  let currentChunk = "";
  let chunkId = 0;

  const initialChunkSize = chunkSize; // Initial chunk size in characters
  let targetSize = initialChunkSize;   // Current target chunk size
  const maxChunkSize = 4000;           // Maximum chunk size in characters

  return sentences.reduce((chunks, sentence, i, arr) => {
    // Calculate the potential new chunk if the current sentence is added
    const potentialChunk = currentChunk + ' ' + sentence.trim();
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
      const isEvery7thChunk = (chunkId % 7) === 0;

      // Adjust the target size based on conditions
      if (isEvery7thChunk || targetSize >= maxChunkSize) {
        // Reset to the initial chunk size
        targetSize = initialChunkSize;
      } else {
        // Increase the target size by 50%, ensuring it does not exceed maxChunkSize
        targetSize = Math.min(Math.floor(targetSize * 1.5), maxChunkSize);
      }
    } else {
      // Accumulate the sentence into the current chunk
      currentChunk = potentialChunk.trim();
    }

    // Handle the last chunk if it doesn't meet the target size
    if (currentChunk && !isCurrentChunkSizeGreaterThanOrEqualTargetSize && isEnd) {
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

export const removeAllListeners = () => {
  const listners = Object.values(LISTENERS);
  listners.forEach(listener => {
    window.removeEventListener(listener, () => { });
  });
}