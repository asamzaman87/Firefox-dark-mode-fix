import { Accept } from "react-dropzone";

export const MAX_FILES = 1;
export const ACCEPTED_FILE_TYPES: Accept = {
  "application/pdf": [],
  "application/msword": [],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [],
  "text/plain": [],
};
export const MAX_FILE_SIZE = 1024 * 1024 * 8; // 8MB
export const PROMPT_INPUT_ID = "#prompt-textarea";
export const HELPER_PROMPT = "Keep the below text as it is without changing the original text and don't add any interactional responses just the keep the plain text:"

export const SYNTETHIZE_ENDPOINT = "https://chatgpt.com/backend-api/synthesize";
export const VOICE = "glimmer";
export const AUDIO_FORMAT = "aac";
export const CHUNK_SIZE = 500;
export const TOAST_STYLE_CONFIG = { backgroundColor: "darkred", color: "#fff", border: "1px solid #b30000"}
export const PLAY_RATE_STEP = 0.25;