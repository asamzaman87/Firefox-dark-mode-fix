const loopThroughReaderToExtractMessageId = async (reader, args) => {
    let messageId = "";
    let conversationId = "";
    let createTime = ""
    let text = "";
    let assistant = "";
    try {
        const jsonArgs = JSON.parse(args[1]?.body);
        const prompt = jsonArgs?.messages?.[0]?.content?.parts[0]; //extracting the prompt from the request
        text = jsonArgs?.messages?.[0]?.content?.parts[0];
        // eslint-disable-next-line no-constant-condition
        while (true) {
            const { done, value } = await reader.read();
            const decoder = new TextDecoder("utf-8");
            const textDecoded = decoder.decode(value);

            // —— new: pull out SSE “delta” patches for the assistant’s text
            for (const line of textDecoded.split(/\r?\n/)) {
                if (line.startsWith("data: ")) {
                  try {
                    const data = JSON.parse(line.slice(6));
                    // 1) straight append deltas
                    if (data.p === "/message/content/parts/0" && data.o === "append") {
                      assistant += data.v;
                    }
                    // 2) patch operations
                    else if (data.o === "patch" && Array.isArray(data.v)) {
                      for (const op of data.v) {
                        if (op.p === "/message/content/parts/0") {
                          assistant += op.v;
                        }
                      }
                    }
                    // 3) some “bulk” deltas come as bare strings
                    else if (typeof data.v === "string") {
                      assistant += data.v;
                    }
                    // 4) fallback to full parts array — but only for assistant messages
                    else if (
                      data.v?.message?.content?.parts &&
                      data.v.message.author?.role === "assistant"
                    ) {
                      assistant = data.v.message.content.parts[0] || assistant;
                    }
                  } catch {
                    /* ignore non-JSON or other events */
                  }
                }
              }
  
            const messageIdMatch = textDecoded.match(/"id":\s*"([^"]+)"/g); // Extract the id using regex  
            const createTimeMatch = textDecoded.match(/"create_time":\s*([^,}\s]+)/); // Extract the id using regex
            const conversationIdMatch = textDecoded.match(/"conversation_id":\s*"([^"]+)"/); // Extract the id using regex  
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

            if (done) return { messageId, conversationId, createTime, text, assistant };// Exit loop when reading is complete
        }
    } catch (error) {
        if (error.name !== 'AbortError') {
            console.error('An error occurred while reading the stream:', error);
        }
    }
    return { messageId, conversationId, createTime, text, assistant };
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

    const isSynthesisEndpoint = url.includes(SYNTHESIS_ENDPOINT);
    const isVoicesEndpoint = url.includes(VOICES_ENDPOINT);

    //getting the access token
    if (response && url.includes('backend-api/me')) {
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
    if (response && url.includes('api/auth/signout')) {
        const responseData = await response.clone().json();
        if (responseData?.success) {
            const signoutReceivedEvent = new CustomEvent('SIGNOUT_RECEIVED', {
                detail: responseData,
            });
            window.dispatchEvent(signoutReceivedEvent);
        }
    }

    //read the stream to get the message id and conversation id
    if (hasConversationEndpoint && args[1]?.method === 'POST' && isEventStream) {
        let sentChunkNumber = null;
        if (args[1]?.body) {
            try {
                const req = JSON.parse(args[1].body);
                const firstMsg = req.messages?.[0]?.content?.parts?.[0] || "";
                const m = firstMsg.match(/^\[(\d+)\]/);
                sentChunkNumber = m ? Number(m[1]) : null;
            } catch (_err) {console.log(`An error occured while getting the chunk number in injected.js: ${_err}`)}
        }
 
        const clonedResponse = response.clone(); // Clone the response
        const stream = clonedResponse.body; // Use the body of the cloned response
        if (clonedResponse.status === 429) {
            const rateLimitExceededEvent = new CustomEvent('RATE_LIMIT_EXCEEDED', {
                detail: "You have exceeded the hourly limit for ChatGPT. Please wait a few minutes and try again.",
            });
            window.dispatchEvent(rateLimitExceededEvent);
        } 

        if (clonedResponse.status !== 200 && clonedResponse.status !== 429) {
            const generalErrorEvent = new CustomEvent('GENERAL_ERROR', {
                detail: "GPT Reader is experiencing issues. Please try again later.",
            });
            window.dispatchEvent(generalErrorEvent);
        }

        
        if (stream && clonedResponse.status === 200) {
            const reader = stream.getReader();

            loopThroughReaderToExtractMessageId(reader, args)
            .then(detail => {
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

    if (isSynthesisEndpoint) {
        const clonedResponse = response.clone(); // Clone the response
        if (clonedResponse.status === 404) {
            const rateLimitExceededEvent = new CustomEvent('ERROR', {
                detail: "Message Not Found. Please refresh the page and try again.",
            });
            window.dispatchEvent(rateLimitExceededEvent);
        }
    }

    return response;
};

window.addEventListener("GET_TOKEN", () => {
    if (window && window?.__reactRouterContext?.state.loaderData.root.clientBootstrap.session.accessToken) {
        const accessToken = window.__reactRouterContext?.state.loaderData.root.clientBootstrap.session.accessToken;
        const userId = window.__reactRouterContext?.state.loaderData.root.clientBootstrap.session.user.id;
        const authEvent = new CustomEvent("AUTH_RECEIVED", {
            detail: { accessToken, userId },
        });
        window.dispatchEvent(authEvent);
    }
})

//get all the listed voices
window.addEventListener("GET_VOICES", async () => {
    if (window && window?.__reactRouterContext?.state?.loaderData?.root?.clientBootstrap?.session?.accessToken) {
        const response = await fetch("https://chatgpt.com/backend-api/settings/voices", { headers: { "authorization": `Bearer ${window.__reactRouterContext?.state.loaderData.root.clientBootstrap.session.accessToken}` } });
        const data = await response.json();
        const voicesEvent = new CustomEvent("VOICES", {
            detail: data,
        });
        window.dispatchEvent(voicesEvent);
    }
})

//stop conversation
window.addEventListener("STOP_CONVERSATION", async (e) => {
    if (window && window?.__reactRouterContext?.state?.loaderData?.root?.clientBootstrap?.session?.accessToken) {
        const { conversation_id } = e.detail;
        const response = await fetch("https://chatgpt.com/backend-api/stop_conversation", { method: "POST", body: JSON.stringify({ conversation_id }), headers: { "authorization": `Bearer ${window.__reactRouterContext?.state.loaderData.root.clientBootstrap.session.accessToken}` } });
        const data = await response.json();
        const conversationStoppedEvent = new CustomEvent("CONVERSATION_STOPPED", {
            detail: data,
        });
        window.dispatchEvent(conversationStoppedEvent);
    }
})