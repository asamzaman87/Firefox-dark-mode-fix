import { Accept } from "react-dropzone";

export const THEME_STORAGE_KEY = "gptr/theme";
export const MAX_FILES = 1;
export const ACCEPTED_FILE_TYPES: Accept = {
  "application/pdf": [],
  "application/msword": [],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [],
  "text/plain": [],
};

export const ACCEPTED_FILE_TYPES_FIREFOX: Accept = {
  "text/plain": [".txt"],
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
  "LOADING_ON_VOICE": "LOADING_ON_VOICE",
  "GET_VOICES": "GET_VOICES",
  "STOP_CONVERSATION": "STOP_CONVERSATION",
  "AUDIO_ENDED": "ended",
  "GET_TOKEN": "GET_TOKEN"
}
export const MAX_FILE_SIZE = 1024 * 1024 * 24; // 24MB
export const PROMPT_INPUT_ID = "#prompt-textarea";
export const HELPER_PROMPT = "Repeat the exact text below without any changes, introduction or additional words. Do not summarize, analyze, or prepend/append anything. Just output the text exactly as provided:"
export const SYNTETHIZE_ENDPOINT = "https://chatgpt.com/backend-api/synthesize";
export const VOICE = "glimmer";
export const AUDIO_FORMAT = "aac";
export const CHUNK_SIZE = 400;
export const TOAST_STYLE_CONFIG = { backgroundColor: "darkred", color: "#fff", border: "1px solid #b30000" }
export const TOAST_STYLE_CONFIG_INFO = { backgroundColor: "darkblue", color: "#fff", border: "1px solid #001aff" }
export const PLAY_RATE_STEP = 0.25;
export const DOMAINS = ["chat.com", "chatgpt.com"];
export const MATCH_URLS = ["https://*.chatgpt.com/*", "https://*.chat.com/*", "https://auth.openai.com/*", "https://*.chat.openai.com/*"];
export const FEEDBACK_ENDPOINT = "https://www.readeon.com/api/feedbacks/gpt-feedback";
export const FEEDBACK_GOOGLE_FORM = "https://docs.google.com/forms/d/e/1FAIpQLSdarz80UfaTlU_dZVsN5a_0LBq9FT_wcwNXJ5HtaP9052cEdw/viewform?usp=sharing";
export const UNINSTALL_GOOGLE_FORM = "https://docs.google.com/forms/d/e/1FAIpQLScai09qOvmPcD1ryfK9lG7NY1aTvWEMRVACxHkcM_JKdZkwQg/viewform?usp=header";
export const YOUTUBE_FAQ_VIDEO = "https://youtu.be/zhiRjPAtOHI";
export const MAX_SLIDER_VALUE = 2;
export const MIN_SLIDER_VALUE = 0.5;
export const STEP_SLIDER_VALUE = 0.1;
export const TICKS_TO_DISPLAY = [0.5, 1, 1.5, 2];
export const MODELS_TO_WARN = ["o1", "o3"];
export const CHUNK_TO_PAUSE_ON = 9; //end of chunk
export const LOADING_TIMEOUT = 25000;
export const LOADING_TIMEOUT_FOR_DOWNLOAD = 40000;
export const DOWLOAD_CHUNK_SIZE = 4000;
export const MIN_VOLUME_VALUE = 0;
export const MAX_VOLUME_VALUE = 99;
export const STEP_VOLUME_VALUE = 5;
export const VOLUME_TICKS_TO_DISPLAY = [0, 50, 100];
export const FORWARD_REWIND_TIME = 10; //seconds
export const MALE_VOICES = ["orbit", "breeze", "cove", "ember", "fathom"];
export const REVIEWS_CHROME = "https://chromewebstore.google.com/detail/gpt-reader-free-ai-text-t/aeggkceabpfajnglgaeadofdmeboimml/reviews";
export const REVIEWS_FIREFOX = "https://addons.mozilla.org/en-US/firefox/addon/gpt-reader";
export const SECOND_TO_REDUCE_FROM_DURATION = 20;
// export const BACKEND_URI = "http://localhost:3000/api" //for local testing
export const BACKEND_URI = "https://www.readeon.com/api"
export const BANNER_POLLING_TIME_INTERVAL = 10000;