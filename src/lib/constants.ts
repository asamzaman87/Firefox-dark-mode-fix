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

export const TRANSCRIBER_ACCEPTED_FILE_TYPES_FIREFOX: Accept = {
  "audio/*": []
};

export const TRANSCRIBER_ACCEPTED_FILE_TYPES: Accept = {
  "audio/mpeg": [],       // .mp3
  "audio/wav": [],        // .wav
  "audio/webm": [],       // .webm
  "audio/ogg": [],        // .ogg
  "audio/mp4": [],        // .m4a
  "audio/mp3": [],        // sometimes used
};

export const LIVE_ANALYSER_WINDOW = 2048;

export const FRAME_MS = 20;
export const MIN_SILENCE_MS = 500;

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
  "GET_TOKEN": "GET_TOKEN",
  "GENERAL_ERROR": "GENERAL_ERROR",
  "GET_FORMAT": "GET_FORMAT",
  "FORMAT":     "FORMAT",
}
export const MAX_FILE_SIZE = 1024 * 1024 * 24; // 24MB
export const PROMPT_INPUT_ID = "#prompt-textarea";
export const HELPER_PROMPT = `Your task is to act as a repeater: you will repeat, exactly once, all the provided text after the <<< marker. Do not add, remove, or change anything—no commentary, no analysis, etc. After echoing once, stop immediately. Do not ask any questions or add any extra text.

With that said, here is the text to repeat:

<<<
`;
export const EXTREME_HELPER_PROMPT = `Instruction: We’re playing a simple copying game. I will give you a block of text that comes after the markers <<< and you must echo it back exactly—character for character, word for word, line for line. No additions. No omissions. No modifications. If you fail even once, you lose.

Rules:
1. Only repeat what comes after the <<< markers.
2. Do not add, remove, or change anything—no commentary, no apologies, no questions.
3. Preserve every space, punctuation mark, capitalization, and newline exactly as given.
4. After you have echoed the text, STOP. Do not generate anything else.

Examples:

* ✅ Good (exact echo):
  User provides:
  <<<
  Hello, World!
  You reply:
  Hello, World!

* ❌ Bad (added words):
  You must not reply:
  Hello, World! Nice to meet you.
  Would you like me to repeat anything else?

* ❌ Bad (repeating more than once):
  You must not reply:
  Hello, World!
  Hello, World!

Taking into account the above task, here is the text that I want you to repeat:

<<<
`;
export const HELPER_PROMPT_2 = `Can you give me the punctuation correct version of the text below the <<< markers? Make sure to not omit any text and only output what i requested. Do not include any introductory phrases in your response such as "Here is the corrected text:" nor any followup questions. 

<<<
`;
export const HELPER_PROMPT_3 = `What does the text below the markers <<< say? Make sure to not omit any text and only output what i requested. Do not include any introductory phrases in your response such as "Here is the text:" nor any followup questions. 

<<<
`;
export const HELPER_PROMPTS = [HELPER_PROMPT, HELPER_PROMPT_3, EXTREME_HELPER_PROMPT, HELPER_PROMPT_2];
export const GPT_BREAKER = `Royal Road Log In The Villainess Takes What She Wants by DrivenEntity 18. Alice's Mysterious Friend The rest of the school day had gone on without further incident. In all honesty, Catherine started to wish that something would go wrong just to break up the monotony.`;
export const SYNTHESIZE_ENDPOINT = "https://chatgpt.com/backend-api/synthesize";
export const VOICE = "glimmer";
export const AUDIO_FORMAT = "mp3";
export const CHUNK_SIZE = 300;
export const TOAST_STYLE_CONFIG = { backgroundColor: "darkred", color: "#fff", border: "1px solid #b30000" }
export const TOAST_STYLE_CONFIG_INFO = { backgroundColor: "darkblue", color: "#fff", border: "1px solid #001aff" }
export const PLAY_RATE_STEP = 0.25;
export const DOMAINS = ["chatgpt.com"];
export const MATCH_URLS = ["https://chatgpt.com/*"];
export const FEEDBACK_GOOGLE_FORM = "https://docs.google.com/forms/d/e/1FAIpQLSdarz80UfaTlU_dZVsN5a_0LBq9FT_wcwNXJ5HtaP9052cEdw/viewform?usp=sharing";
export const UNINSTALL_GOOGLE_FORM = "https://docs.google.com/forms/d/e/1FAIpQLScai09qOvmPcD1ryfK9lG7NY1aTvWEMRVACxHkcM_JKdZkwQg/viewform?usp=header";
export const YOUTUBE_FAQ_VIDEO = "https://youtu.be/zhiRjPAtOHI";
export const MAX_SLIDER_VALUE = 2;
export const MIN_SLIDER_VALUE = 0.5;
export const STEP_SLIDER_VALUE = 0.1;
export const TICKS_TO_DISPLAY = [0.5, 1, 1.5, 2];
export const MODELS_TO_WARN = ["o1", "o2", "o3", "o4", "o5", "o6", "o7"];
export const CHUNK_TO_PAUSE_ON = 12; //end of chunk
export const LOADING_TIMEOUT = 60000;
export const LOADING_TIMEOUT_FOR_DOWNLOAD = 60000;
export const DOWLOAD_CHUNK_SIZE = 4000;
export const MIN_VOLUME_VALUE = 0;
export const MAX_VOLUME_VALUE = 99;
export const STEP_VOLUME_VALUE = 5;
export const VOLUME_TICKS_TO_DISPLAY = [0, 50, 100];
export const FORWARD_REWIND_TIME = 10; //seconds
export const MALE_VOICES = ["orbit", "breeze", "cove", "ember", "fathom"];
export const REVIEWS_CHROME = "https://chromewebstore.google.com/detail/gpt-reader-free-ai-text-t/aeggkceabpfajnglgaeadofdmeboimml/reviews";
export const REVIEWS_FIREFOX = "https://addons.mozilla.org/en-US/firefox/addon/gpt-reader";
// export const BACKEND_URI = "http://localhost:3000/api" //for local testing
// GPT Reader uses its own backend to get live announcements as well as to store user feedback
export const BACKEND_URI = "https://www.readeon.com/api"
export const BANNER_POLLING_TIME_INTERVAL = 20000;
export const TOKEN_TTL_MS = 10 * 60 * 1000;
export const REFRESH_MARGIN_MS = 15_000;
export const MAX_PLAYBACK_RATE = 1.5;
export const PRO_VOICES: string[] = [];
export const LOCAL_LOGS = false;
export const DISCOUNT_PRICE_ID = "price_1RdmRQLARZb1bIqHtbAKpKA7";
export const FIRST_DISCOUNT_PRICE_ID = "price_1S6qdOLARZb1bIqHixjkvhwc";
export const ORIGINAL_PRICE_ID = "price_1RokrdLARZb1bIqHJf3nXvxX";
export const FREE_DOWNLOAD_CHUNKS = 3;
export const DISCOUNT_FREQUENCY = 5;