import { Button } from "@/components/ui/button";
import { DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FC } from "react";

interface AlertPopupProps {
  setConfirmed: (confirmed: boolean) => void
}
const AlertPopup: FC<AlertPopupProps> = ({ setConfirmed }) => {
  const LOGO = chrome.runtime.getURL('logo-128.png');

  return (
    <div className="gpt:flex gpt:flex-col gpt:justify-center gpt:items-center gpt:h-full">
      <DialogHeader className={"gpt:sr-only"}>
        <DialogTitle className="gpt:inline-flex gpt:flex-col gpt:justify-center gpt:items-center gpt:gap-2">
          {chrome.i18n.getMessage("are_you_sure")}
        </DialogTitle>
        <DialogDescription></DialogDescription>
      </DialogHeader>

      <div className="gpt:rounded-2xl gpt:border gpt:border-gray-200 gpt:dark:border-gray-700 gpt:bg-gray-50 gpt:dark:bg-gray-800 gpt:p-6 gpt:shadow gpt:w-full gpt:md:w-1/2 gpt:flex gpt:flex-col gpt:gap-6 gpt:justify-center gpt:items-center">

        <section className="gpt:flex gpt:flex-col gpt:justify-center gpt:items-center gpt:gap-4 gpt:text-justify">
          <img src={LOGO} alt="Fix this Logo" className="gpt:size-12" />
          <h1 className="gpt:text-xl gpt:font-medium">
            {chrome.i18n.getMessage("gpt_reader_notice")}
          </h1>
          <p className="dark:text-gray-200 gpt:text-gray-600 gpt:leading-loose">
            {chrome.i18n.getMessage("gpt_reader_chunk_explanation")}
          </p>
          <p className="gpt:font-medium">
            {chrome.i18n.getMessage("acknowledge_and_accept")}
          </p>
        </section>

        <footer className="gpt:flex gpt:items-end gpt:justify-center gpt:gap-4">
          <Button variant={"ghost"} className="gpt:border gpt:border-gray-200 gpt:dark:border-gray-700 gpt:bg-gray-50 gpt:dark:bg-gray-800 gpt:[&_svg]:size-6 gpt:transition-all" onClick={() => setConfirmed(true)}>
            {chrome.i18n.getMessage("continue")}
          </Button>
          {/* <Button className="gpt:rounded-lg gpt:text-lg" size={"lg"} variant={"outline"} onClick={() => setConfirmed(false)}>No</Button> */}
        </footer>
      </div>
    </div>
  )
}

export default AlertPopup;
