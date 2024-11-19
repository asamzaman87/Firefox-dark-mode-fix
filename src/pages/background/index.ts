console.log("BACKGROUND LOADED");

chrome.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
    console.log("BACKGROUND MESSAGE", request);
    switch (request.type) {
        case "ERROR": {
            console.log(request.message);
            break
        }
        case "CREATE": {
            chrome.tabs.create({ url: "https://chat.openai.com/chat?isActive=true" }).then(() => {
                sendResponse({ message: "SUCCESS" });
            }).catch(() => {
                sendResponse({ message: "FAILED" });
            });
            break;
        }
        case "CHANGE_VOICE": {
            chrome.storage.local.set({ "gptr/voice": request.voice });
            sendResponse({ message: "SUCCESS" });
            break;
        }
        default:
            break;
    }
})

// chrome.runtime.onInstalled.addListener(() => {
//     chrome.tabs.create({ url: "https://chat.openai.com/chat?isActive=true" });
// })
