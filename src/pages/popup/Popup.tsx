import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";

const urls = ["https://*.chatgpt.com/*", "https://*.chat.com/*", "https://auth.openai.com/*"]

export default function Popup(): JSX.Element {
  const [isActive, setIsActive] = useState<boolean>(false);
  const [isEnabled, setIsEnabled] = useState<boolean>(false);
  // const [statusCheckInterval, setStatusCheckInterval] = useState<number>(0);

  const getGPTTabs = async () => {
    const tabs = await chrome.tabs.query({url: urls});
    if (tabs.length === 0 || !tabs[0].id) return;

    return tabs
  }

  const getActiveTab = async () => {
    const queryOptions = { active: true, currentWindow: true };
    const tabs = await chrome.tabs.query(queryOptions);
    if (tabs.length === 0 || !tabs[0].id) return;

    return tabs[0];
  }

  const getPort = async () => {
    const queryOptions = { active: true, currentWindow: true };
    const tabs = await chrome.tabs.query(queryOptions);
    if (tabs.length === 0 || !tabs[0].id) return;

    const port = chrome.tabs.connect(tabs[0].id, {
      name: "activate",
    });
    return port;
  }

  const statusCheck = async () => {
    const port = await getPort();
    if (!port) return;

    port.postMessage({
      message: "STATUS",
    });

    port.onMessage.addListener( (msg) => {
      if(msg.type==="STATUS") {
          setIsActive(msg.message);
          chrome.storage.local.get("isAuthenticated", (result) => {
            console.log({result});
            setIsEnabled(result.isAuthenticated);
          });
        }
    });

  }

  const onClick = async () => {
    const port = await getPort();
    if (!port) return;

    port.postMessage({
      message: "ACTIVATE",
    })
    statusCheck();
  };

  const isCurrentTabGpt = async () => {
    const activeTab = await getActiveTab();
    if (!activeTab) return;
    return activeTab.url?.includes("chat.com") || activeTab.url?.includes("chatgpt.com");
  }

  useEffect(() => {
      isCurrentTabGpt().then((isGpt)=>setIsEnabled(!!isGpt));
      statusCheck();
  }, []);

  const switchToActiveTab = async () => {
    const activeTab = await getGPTTabs();
    if (!activeTab?.length || !activeTab[0].id) {
      chrome.tabs.create({url: "https://chatgpt.com"});
      return
    }
    chrome.tabs.update(activeTab[0].id, {active: true});
  }

  const logo = chrome.runtime.getURL('logo-128.png');

  return (
    <div className="flex flex-col items-center justify-evenly gap-4 h-screen w-screen p">
      <div className="inline-flex flex-col justify-center items-center gap-2 font-medium text-lg"><img src={logo} alt="GPT Reader Logo" className="size-10" />GPT Reader</div>
      {isEnabled && <Button disabled={isActive}  onClick={onClick} className="text-xl rounded-lg bg-black text-white">{isActive ? "Active" : "Activate"}</Button>}
      {!isEnabled && <Button  onClick={switchToActiveTab} className="text-xl rounded-lg bg-black text-white">Go to ChatGpt</Button>}
    </div>
  );
}
