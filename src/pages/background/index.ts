import {
  BACKEND_URI,
  BANNER_POLLING_TIME_INTERVAL,
  DOMAINS,
  FEEDBACK_GOOGLE_FORM,
  LISTENERS,
  UNINSTALL_GOOGLE_FORM,
  YOUTUBE_FAQ_VIDEO,
} from "@/lib/constants";
import { getGPTTabs, secureFetch, switchToActiveTab } from "@/lib/utils";

chrome.storage.local.clear();

//listen for messages from popup and content scripts
chrome.runtime.onMessage.addListener(async (request, sender) => {
  switch (request.type) {
    case LISTENERS.AUTH_RECEIVED: {
      chrome.storage.local.set({ isAuthenticated: request.isAuthenticated });
      break;
    }
    case "CONTENT_LOADED": {
      const tabId = sender?.tab?.id;
      if (tabId) {
        chrome.tabs.sendMessage(tabId, {
          type: "OPEN_POPUP",
          payload: "VERIFY_ORIGIN",
        });
      }
      break;
    }
    case "NO_AUTH_TRY_AGAIN": {
      const tabId = sender?.tab?.id;
      if (tabId) {
        chrome.tabs.sendMessage(tabId, {
          type: "OPEN_POPUP",
          payload: "VERIFY_ORIGIN",
        });
      }
      break;
    }
    //verify if triggered from valid origin (onClick on onInstalled event)
    case "VERIFY_ORIGIN": {
      const tabId = sender?.tab?.id;
      if (tabId) {
        const { origin } = (await chrome.storage.local.get("origin")) ?? {};
        if (origin) {
          chrome.tabs.sendMessage(tabId, {
            type: "OPEN_POPUP",
            payload: "ORIGIN_VERIFIED",
          });
        }
      }
      break;
    }
    case "SET_ORIGIN": {
      chrome.storage.local.set({ origin: true });
      break;
    }
    case "CLEAR_ORIGIN": {
      chrome.storage.local.remove("origin");
      break;
    }
    case "OPEN_FEEDBACK": {
      chrome.tabs.create({ url: FEEDBACK_GOOGLE_FORM });
      break;
    }
    case "OPEN_FAQ_VIDEO": {
      chrome.tabs.create({ url: YOUTUBE_FAQ_VIDEO });
      break;
    }
    case "OPEN_REVIEWS": {
      chrome.tabs.create({ url: request.url });
      break;
    }
    case "GET_ANNOUNCEMENTS": {
      handleGetBannerPolling();
      break;
    }
    case "ANNOUNCEMENTS_OPENED": {
      const count = request.count;
      handleBannerCountView(count);
      break;
    }
    default:
      break;
  }
});

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
};

//set badge text and color based on state
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const setBadState = (state: boolean) => {
  if (!state) {
    chrome.action.setIcon({ path: "logo-128.png" });
  } else {
    chrome.action.setIcon({ path: "logo-128-bw.png" });
  }
  return state;
};

// Check if the active tab is GPT and update the badge
const checkActiveTab = async () => {
  const queryOptions = { active: true, currentWindow: true };
  const tabs = await chrome.tabs.query(queryOptions);
  if (tabs.length === 0) return chrome.action.disable();
  const url = tabs[0]?.url;

  if (!url) return true; //was setBadState(true);

  if (!matchUrlToDomain(DOMAINS, url)) return true; //was setBadState(true);

  return false; //was setBadState(false);
};

//check if updated tab or current tab changes URL on redirect is/is redirected to gpt and update badge
chrome.tabs.onUpdated.addListener(async () => {
  checkActiveTab();
});

//check if active tab is gpt and update badge
chrome.tabs.onActivated.addListener(async () => {
  checkActiveTab();
});

//switch to gpt when extension is installed
chrome.runtime.onInstalled.addListener(async () => {
  const manifest = chrome.runtime.getManifest();
  const currentVersion = manifest.version;
  // Should switch to an explicit read, so for first time users the popup is always opened correctly
  const stored = await chrome.storage.sync.get("version");
  const previousVersion = stored.version;

  //update to latest version and return to prevent opening popup (indicates on update)
  if (previousVersion) {
    await chrome.storage.sync.set({ version: currentVersion });
    return;
  }

  //if version not set yet, set it to current version and continue to opening popup
  await chrome.storage.sync.set({ version: currentVersion }); //to persist on update to sent message to avoid opening popup on update

  const tabId = await switchToActiveTab();
  if (tabId) {
    const id = typeof tabId === "string" ? +tabId.split("::")[0] : tabId; //type is string if new tab was created
    chrome.storage.local.set({ origin: true });
    await chrome.tabs.reload(id); //reload tab to update the content
  }
});

// click on extension icon to switch to gpt
chrome.action.onClicked.addListener(async () => {
  const tabId = await switchToActiveTab();
  if (!tabId) return;

  chrome.storage.local.set({ origin: true });

  // A new ChatGPT tab was created (tabId is a "123::new_tab" string)
  if (typeof tabId === "string") {
    const numericId = +tabId.split("::")[0];

    // wait until the tab’s status === "complete", then send the popup message
    const listener = (
      updatedTabId: number,
      info: chrome.tabs.TabChangeInfo
    ) => {
      if (updatedTabId === numericId && info.status === "complete") {
        chrome.tabs.onUpdated.removeListener(listener);
        chrome.tabs.sendMessage(numericId, {
          type: "OPEN_POPUP",
          payload: "ORIGIN_VERIFIED",
        });
      }
    };
    chrome.tabs.onUpdated.addListener(listener);
    return;
  }

  // Existing ChatGPT tab – send immediately
  chrome.tabs.sendMessage(tabId, {
    type: "OPEN_POPUP",
    payload: "ORIGIN_VERIFIED",
  });
});

const handleGetBannerPolling = async () => {
  const activeTab = await getGPTTabs();
  if (!activeTab?.length || !activeTab[0].id) return;
  if (activeTab[0].id) {
    const tabId = activeTab[0].id;
    try {
      // Used to fetch user announcements
      const banner = await secureFetch(
        `${BACKEND_URI}/gpt-reader/banner`
      );
      const {data} = await banner.json();
      chrome.tabs.sendMessage(tabId, { type: "GET_BANNER", payload: data });
    } catch (error) {
      console.log(error);
    }
  }
};

const handleGetBannerCount = async()=>{
  const activeTab = await getGPTTabs();
  if (!activeTab?.length || !activeTab[0].id) return;
  if (activeTab[0].id) {
    const tabId = activeTab[0].id;
    const date = await chrome.storage.sync.get("countLastViewedOn");
    // Get the count for notification purposes
    try {
      const banner = await secureFetch(
        `${BACKEND_URI}/gpt-reader/banner/count${date && date.countLastViewedOn ? `?startDate=${date.countLastViewedOn}` : ""}`
      );
      const {count} = await banner.json();
      chrome.tabs.sendMessage(tabId, { type: "GET_BANNER_COUNT", payload: count });
    } catch (error) {
      console.log(error);
    }
  }
}

const handleBannerCountView = async (count: number) =>{
  await chrome.storage.sync.set({ bannerCount: count, countLastViewedOn: new Date().toISOString() });
}

// We poll to make sure that announcements are always up to date
const startPolling = async () => {
  const stored = await chrome.storage.sync.get("pollingInterval");
  const interval = stored.pollingInterval;
  if (interval) {
    clearInterval(interval);
  }
  const intervalId = setInterval(handleGetBannerCount, BANNER_POLLING_TIME_INTERVAL); 
  chrome.storage.sync.set({ pollingInterval: intervalId });
  
};


startPolling();

chrome.runtime.setUninstallURL(UNINSTALL_GOOGLE_FORM);
