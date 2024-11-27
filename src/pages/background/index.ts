import { LISTENERS } from "@/lib/constants";

console.log("BACKGROUND LOADED");
chrome.storage.local.clear();

chrome.runtime.onMessage.addListener(async (request) => {
    switch (request.type) {
        case LISTENERS.AUTH_RECEIVED:{
            console.log("BACKGROUND MESSAGE", request);
            chrome.storage.local.set({isAuthenticated: request.isAuthenticated});
            break;
        }
        case "CLEAR":{
            console.log("CLEAR")
            chrome.storage.local.clear();
            break;
        }
        default:
            break;
    }
})

// chrome.runtime.onInstalled.addListener(() => {
//     chrome.tabs.create({ url: "https://chat.openai.com/chat?isActive=true" });
// })

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    if (changeInfo.status === "complete" && (tab?.url?.includes("https://chatgpt.com/auth/logout"))) {
        console.log("LOGOUT")
        chrome.runtime.sendMessage({type:"CLEAR"})
    }
})

chrome.tabs.onActivated.addListener(async()=>{
    const queryOptions = { active: true, currentWindow: true };
    const tabs = await chrome.tabs.query(queryOptions);
    if(tabs.length===0) return chrome.action.disable();

    if(tabs[0]?.url?.includes("chat.com") || tabs[0]?.url?.includes("chatgpt.com")) {
        chrome.action.setIcon({path: "logo-128.png"});
    } else {
        chrome.action.setIcon({path: "logo-128-bw.png"});
    }
});