/* eslint-disable @typescript-eslint/no-unused-vars */
const isFirefox = typeof InstallTrigger !== 'undefined'
  || /firefox/i.test(navigator.userAgent);

const LOCAL_LOGS = false;

// a global flag
let shouldAbortStream = false;

// a place to hold the last‐seen chunk length
let chunkText = null;

let sentChunkNumber = null;

if (!isFirefox) {
    // whenever SET_CHUNK_INFO fires, stash it
    window.addEventListener("SET_CHUNK_INFO", e => {
        chunkText = e.detail.chunkText;
    });
    // listen for our custom stop event
    window.addEventListener("STOP_STREAM_LOOP", () => {
        shouldAbortStream = true;
    });
}

function normalizeAlphaNumeric(str) {
  // This will keep all Unicode letters and digits
  return str.replace(/[^\p{L}\p{N}]/gu, "").toLowerCase();
}
  
const loopThroughReaderToExtractMessageId = async (reader, args) => {
    let messageId = "";
    let conversationId = "";
    let createTime = ""
    let text = "";
    let assistant = "";
    let done = false;
    let stopConvo = false;
    let target = null;
    let chunkLength = null;
    try {
        const jsonArgs = JSON.parse(args[1]?.body || "{}");
        const prompt = jsonArgs?.messages?.[0]?.content?.parts[0]; //extracting the prompt from the request
        text = jsonArgs?.messages?.[0]?.content?.parts[0];
        // eslint-disable-next-line no-constant-condition
        // → wait for the hook to tell us this chunk’s expected length
        // → get the chunk length (use the stashed one if it already arrived)
        if (chunkText !== null) {
            chunkLength = chunkText.length;
            target = chunkText;
        } else {
            // firefox fallback
            if (sentChunkNumber === null || !text.includes("<<<") || !text.includes(`[${sentChunkNumber}]`)) {
                return;
            }
            const markerPos = text.lastIndexOf("<<<");
            const raw = markerPos >= 0
                ? text.slice(markerPos + 3)
                : text;
            // strip any HTML and get exactly what would be rendered as text
            const wrapper = document.createElement("div");
            wrapper.innerHTML = `<p>${raw}</p>`;
            const rendered = wrapper.innerText || "";
            target = normalizeAlphaNumeric(rendered);
            chunkLength = target.length;
        }
  
        const threshold = chunkLength;
        let lastProgress = Date.now();
        let prevVal = '';
  
        // eslint-disable-next-line no-constant-condition
        while (true) {
            const readResult = await reader.read();
            done = readResult.done;
            const value = readResult.value;
            // if we haven’t received any new assistant text in 5 s, trigger abort
            const abortCount = Number(localStorage.getItem("gptr/abortCount")) || 1;
            const abortTimeout = 5_000 + (abortCount * 3_000);
            if (Date.now() - lastProgress >= abortTimeout && !done) {
                console.log("No stream progress for", abortTimeout,"s—aborting...");
                shouldAbortStream = true;
            }
  
            if (shouldAbortStream || localStorage.getItem("gptr/abort") === "true") {
                if (LOCAL_LOGS) console.log("[Injected.js] Aborting stream loop");
                if (localStorage.getItem("gptr/abort") !== "true") stopConvo = true;
                if ((normalizeAlphaNumeric(assistant).length === threshold && threshold) && normalizeAlphaNumeric(assistant) === target.substring(0, normalizeAlphaNumeric(assistant).length)) {
                  stopConvo = false;
                  if (LOCAL_LOGS) console.log("[Injected.js] Aborting with a match on the target");
                }
                localStorage.setItem('gptr/abort', 'false');
                shouldAbortStream = false;
                return { messageId, conversationId, createTime, text, assistant, stopConvo, target };
            }
            
            const decoder = new TextDecoder("utf-8");
            const textDecoded = decoder.decode(value);

            // —— new: pull out SSE “delta” patches for the assistant’s text
            for (const line of textDecoded.split(/\r?\n/)) {
                if (line.startsWith("data: ")) {
                  try {
                    const data = JSON.parse(line.slice(6));
                    // Ignore non-delta “info” payloads early
                    if (data?.type) continue; // e.g., server_ste_metadata, title_generation, message_stream_complete

                    // 1) Single-op append/replace directly at the root
                    if (data.p === "/message/content/parts/0" && (data.o === "append" || data.o === "replace")) {
                      if (typeof data.v === "string") assistant += data.v;
                      continue;
                    }

                    // 2) Batched ops: either explicit { o:"patch", v:[...] } OR implicit { v:[...] }
                    if ((data.o === "patch" && Array.isArray(data.v)) || Array.isArray(data.v)) {
                      const ops = Array.isArray(data.v) ? data.v : [];
                      for (const op of ops) {
                        if (op?.p === "/message/content/parts/0" && (op.o === "append" || op.o === "replace")) {
                          if (typeof op.v === "string") assistant += op.v;
                        }
                      }
                      continue;
                    }

                    // 3) Some providers sometimes send raw strings; ignore known non-text paths
                    if (
                      typeof data.v === "string" &&
                      data.p !== "/message/status" &&
                      data.p !== "/message/metadata/message_locale"
                    ) {
                      assistant += data.v;
                      continue;
                    }

                    // 4) Fallback snapshot: full assistant message with parts array
                    if (data.v?.message?.content?.parts && data.v?.message?.author?.role === "assistant") {
                      // join in case future models send multiple parts
                      const parts = data.v.message.content.parts;
                      if (Array.isArray(parts)) assistant = parts.join("");
                    }
                  } catch {
                    /* ignore non-JSON or other events */
                  }
                }
              }
            
            if (value !== prevVal) {
                lastProgress = Date.now();
            }
  
            const messageIdMatch = textDecoded.match(/"id":\s*"([^"]+)"/g); // Extract the id using regex  
            const createTimeMatch = textDecoded.match(/"create_time":\s*([^,}\s]+)/); // Extract the id using regex
            const conversationIdMatch = textDecoded.match(/"conversation_id":\s*"([^"]+)"/); // Extract the id using regex 
            const normAssistant = normalizeAlphaNumeric(assistant);

            //extracting the message id from the response 
            if (messageIdMatch?.length) {
                //if there are multiple message ids, take the last one 
                //if there are 3 messaged id's  i.e. 1. id with role system 2. id with role user 3. id with role assistant we pick the last one(role assitant)
                const rawMesssageId = messageIdMatch.length > 1 ? messageIdMatch[messageIdMatch.length - 1] : messageIdMatch[0];
                messageId = rawMesssageId.replace(/"/g, "").replace(/id: /g, "");
            }
            if (conversationIdMatch) conversationId = conversationIdMatch[1];
            if (createTimeMatch) createTime = createTimeMatch[1];

            if (messageId && conversationId && createTime) {
                //sending the prompt to the content script
                const messageIdEvent = new CustomEvent("RECEIVED_MESSAGE_ID", { detail: { messageId, createTime, text: prompt } });
                window.dispatchEvent(messageIdEvent);
            }
            prevVal = value;
            // → once we’ve passed the threshold, notify the hook
            if (((normalizeAlphaNumeric(assistant).length > threshold && threshold) || normAssistant !== target.substring(0, normAssistant.length))) {
                // immediately tell the server to stop sending more SSE
                if (LOCAL_LOGS) console.log("[loopThroughReaderToExtractMessageId] Sending stop_conversation SSE for messageId:", messageId);
                return { messageId, conversationId, createTime, text, assistant, stopConvo, target };
                // if (conversationId) {
                //     // reuse the original auth header if there was one in the request args
                //     const authHeader = args[1]?.headers?.Authorization;
                //     origFetch("https://chatgpt.com/backend-api/stop_conversation", {
                //         method: "POST",
                //         headers: {
                //             "Content-Type": "application/json",
                //             ...(authHeader ? { Authorization: authHeader } : {}),
                //         },
                //         body: JSON.stringify({ conversation_id: conversationId }),
                //     }).catch((e) => console.warn("stop_conversation failed", e));
                //     stopConvo = true;
                //     return { messageId, conversationId, createTime, text, assistant, stopConvo };
                // }
            }
            // or if the stream is done
            if (done) {
                if (LOCAL_LOGS) console.log("[loopThroughReaderToExtractMessageId] Stream is done for messageId:", messageId);
                return { messageId, conversationId, createTime, text, assistant, stopConvo, target }; // Exit loop when reading is complete
            }
        }
    } catch (error) {
        if (error.name !== 'AbortError') {
            console.error('An error occurred while reading the stream:', error);
        }
    }
    // eslint-disable-next-line no-undef
    return { messageId, conversationId, createTime, text, assistant, stopConvo, target };
};

const CONVERSATION_ENDPOINT = "backend-api/conversation";
const CONVERSATION_F_ENDPOINT = "backend-api/f/conversation";
const SYNTHESIS_ENDPOINT = "backend-api/synthesize";
const VOICES_ENDPOINT = "backend-api/settings/voices"; 
const { fetch: origFetch } = window;

// Fetches the necessary information from specific endpoints for text to speech purposes
window.fetch = async (...args) => {
    const response = await origFetch(...args);
    const { url, headers } = response;
    const hasConversationEndpoint = url.includes('conversation');
    const contentType = headers.get("content-type") || "";
    const isEventStream = contentType.includes("event-stream");

    const isVoicesEndpoint = url.includes(VOICES_ENDPOINT);

    //getting the access token
    if (response && url.endsWith('backend-api/me') && args[0].method === "GET") {
        let accessToken;
        if (args.length > 1 && args[1]?.headers) {
            accessToken = args[1].headers.Authorization;
        }

        const responseData = await response.clone().json();

        if (accessToken && responseData?.id && !responseData?.id?.startsWith('ua-')) {
            const authReceivedEvent = new CustomEvent('AUTH_RECEIVED', {
                detail: { ...responseData, accessToken },
            });
            window.dispatchEvent(authReceivedEvent);
        }
    }

    //signing out
    if (response && url.endsWith("api/auth/signout")) {
      const responseData = await response.clone().json();
      const signoutReceivedEvent = new CustomEvent("SIGNOUT_RECEIVED", {
        detail: responseData,
      });
      window.dispatchEvent(signoutReceivedEvent);
    }

    //read the stream to get the message id and conversation id
    if (hasConversationEndpoint && args[1]?.method === 'POST') {
        if (!localStorage.getItem("gptr/sended")) {
          if (localStorage.getItem("gptr/active") === "true") {
            console.warn("[injected.js] Returning early since no gptr/sended found");
          }
          return response;
        }
        if (args[1]?.body) {
            try {
                localStorage.removeItem("gptr/sended");
                const req = JSON.parse(args[1].body);
                const firstMsg = req.messages?.[0]?.content?.parts?.[0] || "";
                const m = firstMsg.match(/^\[(\d+)\]/);
                sentChunkNumber = m ? Number(m[1]) : null;
                if (LOCAL_LOGS) console.log("[injected.js] Recieved chunk number:", sentChunkNumber);
            } catch (_err) {
                if (url.endsWith('/conversation')) {
                    // dispatch a general error if we can't even parse the request
                    const generalErrorEvent = new CustomEvent('GENERAL_ERROR', {
                        detail: {
                            message: "GPT Reader is experiencing issues. Please try again later.",
                            chunkNdx: sentChunkNumber
                        },
                    });
                    window.dispatchEvent(generalErrorEvent);
                }
                console.error("Chunk-number parse failed:", _err);
                return response;
            }
        }
 
        const clonedResponse = response.clone(); // Clone the response
        const stream = clonedResponse.body; // Use the body of the cloned response
        // I am being specific with the endpoint for the error, since 404 and other errors will not have a content type of event-stream
        if (clonedResponse.status === 429 && url.endsWith('/conversation')) {
            const rateLimitExceededEvent = new CustomEvent('RATE_LIMIT_EXCEEDED', {
                detail: {
                    message: "You have exceeded the hourly limit for ChatGPT. Please wait a few minutes and try again.",
                    chunkNdx: sentChunkNumber
                },
            });
            window.dispatchEvent(rateLimitExceededEvent);
        } 

        if (clonedResponse.status !== 200 && clonedResponse.status !== 429 && url.endsWith('/conversation')) {
            const generalErrorEvent = new CustomEvent('GENERAL_ERROR', {
                detail: {
                    message: "GPT Reader is experiencing issues. Please try again later.",
                    chunkNdx: sentChunkNumber
                },
            });
            window.dispatchEvent(generalErrorEvent);
        }

        
        if (stream && clonedResponse.status === 200 && isEventStream) {
            const reader = stream.getReader();
            loopThroughReaderToExtractMessageId(reader, args)
            .then(detail => {
                if (LOCAL_LOGS) console.log("[injected.js] End of stream event dispatched for chunk number:", sentChunkNumber);
                window.dispatchEvent(new CustomEvent("END_OF_STREAM", { detail: {...detail, chunkNdx: sentChunkNumber} }));
            })
            .catch(err => console.error("stream error:", err));
        }
    }

    //get all voices
    if (isVoicesEndpoint && args[1].method === "GET") {
        const clonedResponse = response.clone(); // Clone the response
        const voices = await clonedResponse.json(); // Use the body of the cloned response
        const voicesEvent = new CustomEvent('VOICES', {
            detail: voices,
        });
        window.dispatchEvent(voicesEvent);
    }

    return response;
};

window.addEventListener("GET_TOKEN", () => {
  const session = window.__reactRouterContext
    ?.state
    ?.loaderData
    ?.root
    ?.clientBootstrap
    ?.session;
  if (!session?.accessToken) {
    console.warn("No access token found");
    return;
  }

  const { accessToken, user } = session;
  window.dispatchEvent(new CustomEvent("AUTH_RECEIVED", {
    detail: {
      accessToken,
      userId: user?.id,
      userData: user
    }
  }));
});

window.addEventListener("GET_VOICES", async () => {
  const session = window.__reactRouterContext
    ?.state
    ?.loaderData
    ?.root
    ?.clientBootstrap
    ?.session;
  if (!session?.accessToken) {
    console.warn("No access token found");
    return;
  }

  const res  = await fetch(
    "https://chatgpt.com/backend-api/settings/voices",
    { headers: { "Authorization": `Bearer ${session.accessToken}` } }
  );
  const data = await res.json();
  window.dispatchEvent(new CustomEvent("VOICES", { detail: data }));
});

window.addEventListener("STOP_CONVERSATION", async (e) => {
  const session = window.__reactRouterContext
    ?.state
    ?.loaderData
    ?.root
    ?.clientBootstrap
    ?.session;
  if (!session?.accessToken) {
    console.warn("No access token found");
    return;
  }

  const { conversation_id } = e.detail;
  const res = await fetch(
    "https://chatgpt.com/backend-api/stop_conversation",
    {
      method: "POST",
      headers: {
        "Content-Type":  "application/json",
        "Authorization": `Bearer ${session.accessToken}`
      },
      body: JSON.stringify({ conversation_id })
    }
  );
  const data = await res.json();
  window.dispatchEvent(new CustomEvent("CONVERSATION_STOPPED", { detail: data }));
});