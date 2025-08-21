import { Button } from "@/components/ui/button";
import { switchToActiveTab } from "@/lib/utils";
import { useEffect, useState } from "react";

export default function Popup(): JSX.Element {
  const [isActive, setIsActive] = useState<boolean>(false);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isValidUrl, setIsValidUrl] = useState<boolean>(false);

  const getActiveTab = async () => {
    const queryOptions = { active: true, currentWindow: true };
    const tabs = await chrome.tabs.query(queryOptions);
    if (tabs.length === 0 || !tabs[0].id) return;

    return tabs[0];
  }

  const getPort = async () => {
    const queryOptions = { active: true, currentWindow: true };
    const tabs = await chrome.tabs.query(queryOptions);
    if (tabs.length === 0 || !tabs[0].id) return null;
    try {
      return chrome.tabs.connect(tabs[0].id, { name: "activate" });
    } catch (_) {
      return null; // no content script in this tab
    }
  }

  const statusCheck = async () => {
    const port = await getPort();
    if (!port) return;

    port.postMessage({
      message: "STATUS",
    });

    port.onMessage.addListener((msg) => {
      if (msg.type === "STATUS") {
        setIsActive(msg.message);
        chrome.storage.local.get("isAuthenticated", (result) => {
          setIsAuthenticated(result.isAuthenticated);
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
    return activeTab.url?.includes("chatgpt.com");
  }

  useEffect(() => {
    (async () => {
      const isGpt = await isCurrentTabGpt();
      setIsValidUrl(!!isGpt);
      if (isGpt) {
        await statusCheck();
      }
    })();
  }, []);

  const logo = chrome.runtime.getURL('logo-128.png');

  return (
    <div className="gpt:flex gpt:flex-col gpt:items-center gpt:justify-center gpt:gap-4 gpt:h-screen gpt:w-screen gpt:p">
      {/* <div className={gpt:"absolute gpt:top-4 gpt:left-4 gpt:size-max"}>
        <FeedbackPopup />
      </div> */}
      <div className="gpt:inline-flex gpt:flex-col gpt:justify-center gpt:items-center gpt:gap-2 gpt:font-medium gpt:text-lg"><img src={logo} alt="GPT Reader Logo" className="gpt:size-10" />GPT Reader</div>
      {isAuthenticated && isValidUrl && <Button disabled={isActive} onClick={onClick} className="gpt:text-xl gpt:rounded-lg gpt:bg-black gpt:text-white">{isActive ? "Active" : "Activate"}</Button>}
      {!isAuthenticated && isValidUrl && <Button onClick={onClick} className="gpt:text-xl gpt:rounded-lg gpt:bg-black gpt:text-white">Login to use GPT Reader</Button>}
      {!isValidUrl && <Button onClick={switchToActiveTab} className="gpt:text-xl gpt:rounded-lg gpt:bg-black gpt:text-white">Click here to go to ChatGPT</Button>}
    </div>
  );
}
