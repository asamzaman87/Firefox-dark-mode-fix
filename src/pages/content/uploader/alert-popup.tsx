import { Button } from "@/components/ui/button";
import { DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FC } from "react";

interface AlertPopupProps {
  setConfirmed: (confirmed: boolean) => void
}
const AlertPopup: FC<AlertPopupProps> = ({ setConfirmed }) => {
  const LOGO = chrome.runtime.getURL('logo-128.png');

  return (
    <div className="flex flex-col justify-center items-center h-full">
      <DialogHeader className={"sr-only"}>
        <DialogTitle className="inline-flex flex-col justify-center items-center gap-2">Are you sure</DialogTitle>
        <DialogDescription></DialogDescription>
      </DialogHeader>

      <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-6 shadow w-full md:w-1/2 flex flex-col gap-6 justify-center items-center">

        <section className="flex flex-col justify-center items-center gap-4 text-justify">
          <img src={LOGO} alt="GPT Reader Logo" className="size-12"  />
          <h1 className="text-xl font-medium">GPT Reader Notice</h1>
          <p className="dark:text-gray-200 text-gray-600 leading-loose">
          GPT Reader works by breaking down large text into smaller chunks and sending them to ChatGPT for analysis. This is a normal and expected process. However, depending on your usage, you might temporarily reach ChatGPT&apos;s rate limits. If this happens, you may need to wait about an hour before using ChatGPT or this extension again.
          </p>
          <p className="font-medium">By continuing, you acknowledge and accept this as part of using the extension.</p>
          {/* <p className="font-bold">Please note that you will not be able to use this extension if you click No.</p> */}
        </section>

        <footer className="flex items-end justify-center gap-4">
          <Button className="w-full text-lg rounded-lg dark:bg-gray-200 dark:text-gray-900 hover:bg-gray-900 bg-gray-900 text-gray-100" size={"lg"} onClick={() => setConfirmed(true)}>Continue</Button>
          {/* <Button className="rounded-lg text-lg" size={"lg"} variant={"outline"} onClick={() => setConfirmed(false)}>No</Button> */}
        </footer>
      </div>

    </div>
  )
}

export default AlertPopup;
