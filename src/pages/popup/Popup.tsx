import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import FeedbackPopup from "../content/uploader/feedback-popup";
import { switchToActiveTab } from "@/lib/utils";

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
    return activeTab.url?.includes("chat.com") || activeTab.url?.includes("chatgpt.com");
  }

  useEffect(() => {
    isCurrentTabGpt().then((isGpt) => setIsValidUrl(!!isGpt));
    statusCheck();
  }, []);

  const logo = chrome.runtime.getURL('logo-128.png');

  return (
    <div className="flex flex-col items-center justify-evenly gap-4 h-screen w-screen p">
      <div className={"absolute top-4 left-4 size-max"}>
        <FeedbackPopup />
      </div>
      <div className="inline-flex flex-col justify-center items-center gap-2 font-medium text-lg"><img src={logo} alt="GPT Reader Logo" className="size-10" />GPT Reader</div>
      {isAuthenticated && isValidUrl && <Button disabled={isActive} onClick={onClick} className="text-xl rounded-lg bg-black text-white">{isActive ? "Active" : "Activate"}</Button>}
      {!isAuthenticated && isValidUrl && <Button onClick={onClick} className="text-xl rounded-lg bg-black text-white">Login to use GPT Reader</Button>}
      {!isValidUrl && <Button onClick={switchToActiveTab} className="text-xl rounded-lg bg-black text-white">Click here to go to ChatGPT</Button>}
    </div>
  );
}
