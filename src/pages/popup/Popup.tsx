import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";

export default function Popup(): JSX.Element {
  const [isActive, setIsActive] = useState<boolean>(false);
  // const [statusCheckInterval, setStatusCheckInterval] = useState<number>(0);

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
          console.log(msg);
          setIsActive(msg.message);
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

  useEffect(() => {
      statusCheck();
  }, []);


  const logo = chrome.runtime.getURL('logo-128.png');

  return (
    <div className="flex flex-col items-center justify-evenly gap-4 h-screen w-screen p">
      <div className="inline-flex flex-col justify-center items-center gap-2 font-medium text-lg"><img src={logo} alt="GPT Reader Logo" className="size-10" />GPT Reader</div>
      <Button disabled={isActive}  onClick={onClick} className="text-xl rounded-lg bg-black text-white">{isActive ? "Active" : "Activate"}</Button>
    </div>
  );
}
