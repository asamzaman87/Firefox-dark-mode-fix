import { LISTENERS, DOMAINS } from "@/lib/constants";
import { switchToActiveTab } from "@/lib/utils";

console.log("BACKGROUND LOADED");
chrome.storage.local.clear();

chrome.runtime.onMessage.addListener(async (request) => {
    switch (request.type) {
        case LISTENERS.AUTH_RECEIVED:{
            console.log("BACKGROUND MESSAGE", request);
            chrome.storage.local.set({isAuthenticated: request.isAuthenticated});
            break;
        }
        default:
            break;
    }
})

const getDomain = (url: string) => new URL(url).hostname;

const matchUrlToDomain = (domains: string[], url: string) => {
    const urlDomain = getDomain(url);
    
    for (const domain of domains) {
        // If the URL's domain is exactly the same as the domain in the array
        if (urlDomain === domain) {
            return true;
        }
        
        // If the URL's domain ends with the domain from the array (e.g., subdomain match)
        if (urlDomain.endsWith(domain)) {
            return true;
        }
    }

    return false;
}

const checkActiveTab = async () => {
    const queryOptions = { active: true, currentWindow: true };
    const tabs = await chrome.tabs.query(queryOptions);
    if (tabs.length === 0) return chrome.action.disable();
    const url = tabs[0]?.url;

    if (!url) return chrome.action.setIcon({ path: "logo-128-bw.png" });

    if (!matchUrlToDomain(DOMAINS, url)) return chrome.action.setIcon({ path: "logo-128-bw.png" });
    
    chrome.action.setIcon({ path: "logo-128.png" });
}

chrome.tabs.onUpdated.addListener(async () => {
    checkActiveTab();
})

chrome.tabs.onActivated.addListener(async()=>{
    checkActiveTab();
});

chrome.runtime.onInstalled.addListener(async () => {
    switchToActiveTab().then((tabId) => {
        if (tabId) {
            chrome.tabs.reload(tabId);
        }
    });
})