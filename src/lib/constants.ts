import { Accept } from "react-dropzone";

export const THEME_STORAGE_KEY = "gptr/theme";
export const MAX_FILES = 1;
export const ACCEPTED_FILE_TYPES: Accept = {
  "application/pdf": [],
  "application/msword": [],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [],
  "text/plain": [],
};
export const LISTENERS = {
  "RECEIVED_MESSAGE_ID": "RECEIVED_MESSAGE_ID",
  "RATE_LIMIT_EXCEEDED": "RATE_LIMIT_EXCEEDED",
  "END_OF_STREAM": "END_OF_STREAM",
  "ERROR": "ERROR",
  "AUTH_RECEIVED": "AUTH_RECEIVED",
  "SIGNOUT_RECEIVED": "SIGNOUT_RECEIVED",
  "CONVERSATION_STOPPED": "CONVERSATION_STOPPED",
  "VOICES": "VOICES",
  "GET_VOICES": "GET_VOICES",
  "STOP_CONVERSATION": "STOP_CONVERSATION",
  "AUDIO_ENDED": "ended",
  "GET_TOKEN": "GET_TOKEN"
}
export const MAX_FILE_SIZE = 1024 * 1024 * 24; // 24MB
export const PROMPT_INPUT_ID = "#prompt-textarea";
export const HELPER_PROMPT = "Reply back to this prompt with everything below this line word by word and nothing else:"
export const SYNTETHIZE_ENDPOINT = "https://chatgpt.com/backend-api/synthesize";
export const VOICE = "glimmer";
export const AUDIO_FORMAT = "aac";
export const CHUNK_SIZE = 400;
export const TOAST_STYLE_CONFIG = { backgroundColor: "darkred", color: "#fff", border: "1px solid #b30000" }
export const PLAY_RATE_STEP = 0.25;
export const DOMAINS = ["chat.com", "chatgpt.com"];
export const MATCH_URLS = ["https://*.chatgpt.com/*", "https://*.chat.com/*", "https://auth.openai.com/*"];
export const FEEDBACK_ENDPOINT = "https://www.readeon.com/api/feedbacks/gpt-feedback";
export const MAX_SLIDER_VALUE = 2;
export const MIN_SLIDER_VALUE = 0.5;
export const STEP_SLIDER_VALUE = 0.1;