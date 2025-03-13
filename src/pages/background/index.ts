import { DOMAINS, FEEDBACK_GOOGLE_FORM, LISTENERS, UNINSTALL_GOOGLE_FORM, YOUTUBE_FAQ_VIDEO } from "@/lib/constants";
import { switchToActiveTab } from "@/lib/utils";

////console.log("BACKGROUND LOADED");
chrome.storage.local.clear();

//listen for messages from popup and content scripts
chrome.runtime.onMessage.addListener(async (request, sender) => {
    switch (request.type) {
        case LISTENERS.AUTH_RECEIVED: {
            ////console.log("BACKGROUND MESSAGE", request);
            chrome.storage.local.set({ isAuthenticated: request.isAuthenticated });
            break;
        }
        case "CONTENT_LOADED": {
            const tabId = sender?.tab?.id;
            if (tabId) {
                chrome.tabs.sendMessage(tabId, { type: "OPEN_POPUP", payload: "VERIFY_ORIGIN" });
            }
            break;
        }
        case "NO_AUTH_TRY_AGAIN": {
            ////console.log("NO_AUTH_TRY_AGAIN");
            const tabId = sender?.tab?.id;
            if (tabId) {
                chrome.tabs.sendMessage(tabId, { type: "OPEN_POPUP", payload: "VERIFY_ORIGIN" });
            }
            break;
        }
        //verify if triggered from valid origin (onClick on onInstalled event)
        case "VERIFY_ORIGIN":{
            const tabId = sender?.tab?.id;
            if (tabId) {
                const {origin} = await chrome.storage.local.get("origin") ?? {};
                if(origin){
                    chrome.tabs.sendMessage(tabId, { type: "OPEN_POPUP", payload: "ORIGIN_VERIFIED" });
                }
            }
            break;
        }
        case "SET_ORIGIN":{
            chrome.storage.local.set({ origin: true });
            break;
        }
        case "CLEAR_ORIGIN":{            
            chrome.storage.local.remove("origin");
            break;
        }
        case "OPEN_FEEDBACK":{
            chrome.tabs.create({ url: FEEDBACK_GOOGLE_FORM });
            break;
        }
        case "OPEN_FAQ_VIDEO":{
            chrome.tabs.create({ url: YOUTUBE_FAQ_VIDEO });
            break;
        }

        // case "UPDATE_BADGE_STATE":{
        //     if(request.state){
        //         chrome.action.setBadgeBackgroundColor({ color: "#b3f2a5" });
        //     }else{
        //         chrome.action.setBadgeBackgroundColor({ color: "#f2aaa5" });
        //     }
        //     break;
        // }
        default:
            break;
    }
})

//get domain from url
const getDomain = (url: string) => new URL(url).hostname;

//check if url domain matches any of the domains in the array
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

//set badge text and color based on state
const setBadState = (state: boolean) => {
    if (!state) {
        // chrome.action.setBadgeText({ text: "ON"});
        // chrome.action.setBadgeTextColor({ color: "#21a108" });
        chrome.action.setIcon({ path: "logo-128.png" });
    } else {
        // chrome.action.setBadgeText({ text: "OFF" });
        // chrome.action.setBadgeTextColor({ color: "#9e1109" });
        chrome.action.setIcon({ path: "logo-128-bw.png" });
    }
    return state;
}

// Check if the active tab is GPT and update the badge
const checkActiveTab = async () => {
    const queryOptions = { active: true, currentWindow: true };
    const tabs = await chrome.tabs.query(queryOptions);
    if (tabs.length === 0) return chrome.action.disable();
    const url = tabs[0]?.url;

    if (!url) return true; //was setBadState(true);

    if (!matchUrlToDomain(DOMAINS, url)) return true; //was setBadState(true);

    return false;  //was setBadState(false);
}

//check if updated tab or current tab changes URL on redirect is/is redirected to gpt and update badge
chrome.tabs.onUpdated.addListener(async () => {
    checkActiveTab();
})

//check if active tab is gpt and update badge
chrome.tabs.onActivated.addListener(async () => {
    checkActiveTab();
});

//switch to gpt when extension is installed
chrome.runtime.onInstalled.addListener(async () => {
    const manifest = chrome.runtime.getManifest();
    const currentVersion = manifest.version;
    const {version: previousVersion} = await chrome.storage.sync.get("version");
    
    //update to latest version and return to prevent opening popup (indicates on update)
    if(previousVersion) {
        chrome.storage.sync.set({ version: currentVersion });    
        return;
    }
    
    //if version not set yet, set it to current version and continue to opening popup
    if(!previousVersion) chrome.storage.sync.set({ version: currentVersion }); //to persist on update to sent message to avoid opening popup on update

    const tabId = await switchToActiveTab();
    if (tabId) {
        const id = typeof tabId === "string" ? +tabId.split("::")[0] : tabId; //type is string if new tab was created
        chrome.storage.local.set({ origin: true });
        await chrome.tabs.reload(id); //reload tab to update the content
    }
})

//click on extension icon to switch to gpt
chrome.action.onClicked.addListener(async () => {
    const tabId = await switchToActiveTab();
    if (tabId) {
        chrome.storage.local.set({ origin: true });
        //open overlay after new tab creation
        if (typeof tabId === "string") {
            //wait for 5 seconds as a new tab was created if tabId is a string
            // setTimeout(() => chrome.tabs.sendMessage(+tabId.split("::")[0], { type: "OPEN_POPUP" }), 5000);
            return;
        }
         chrome.tabs.sendMessage(tabId, { type: "OPEN_POPUP", payload: "ORIGIN_VERIFIED" });
    }
})

chrome.runtime.setUninstallURL(UNINSTALL_GOOGLE_FORM)