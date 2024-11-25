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

chrome.runtime.onConnect.addListener((port) => {
    console.log("CONNECTED");
    port.onMessage.addListener(() => {
        console.log("listening to port", port.name);
        chrome.webRequest.onErrorOccurred.addListener(function (details) {
            console.log(details);
            if (details.statusCode === 429) {
                port.postMessage({ message: details });
            }
            return { cancel: false };
        }, { urls: ["<all_urls>"] });
    });
});

chrome.webRequest.onErrorOccurred.addListener(function (details) {
    console.log(details);
    return { cancel: true };
}, { urls: ["<all_urls>"] });