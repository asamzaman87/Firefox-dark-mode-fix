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
        <DialogTitle className="inline-flex flex-col justify-center items-center gap-2">
          {chrome.i18n.getMessage("are_you_sure")}
        </DialogTitle>
        <DialogDescription></DialogDescription>
      </DialogHeader>

      <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-6 shadow w-full md:w-1/2 flex flex-col gap-6 justify-center items-center">

        <section className="flex flex-col justify-center items-center gap-4 text-justify">
          <img src={LOGO} alt="GPT Reader Logo" className="size-12" />
          <h1 className="text-xl font-medium">
            {chrome.i18n.getMessage("gpt_reader_notice")}
          </h1>
          <p className="dark:text-gray-200 text-gray-600 leading-loose">
            {chrome.i18n.getMessage("gpt_reader_chunk_explanation")}
          </p>
          <p className="font-medium">
            {chrome.i18n.getMessage("acknowledge_and_accept")}
          </p>
        </section>

        <footer className="flex items-end justify-center gap-4">
          <Button className="w-full text-lg rounded-lg dark:bg-gray-200 dark:text-gray-900 hover:bg-gray-900 bg-gray-900 text-gray-100" size={"lg"} onClick={() => setConfirmed(true)}>
            {chrome.i18n.getMessage("continue")}
          </Button>
          {/* <Button className="rounded-lg text-lg" size={"lg"} variant={"outline"} onClick={() => setConfirmed(false)}>No</Button> */}
        </footer>
      </div>
    </div>
  )
}

export default AlertPopup;
