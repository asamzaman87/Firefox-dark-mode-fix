import { Button } from "@/components/ui/button";
import { DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FC } from "react";

interface WebReaderPermissionPopupProps {
  onPrimary: () => void;
}

const WebReaderPermissionPopup: FC<WebReaderPermissionPopupProps> = ({ onPrimary }) => {
  const LOGO = chrome.runtime.getURL("logo-128.png");
  const GUIDE_IMG = chrome.runtime.getURL("webreader.png");

  const title = "You can now Listen to Your Web Pages";
  const body =
    "Right-click any web page to send selected text or the entire page to GPT Reader for listening.";
  const primaryLabel = "Continue";

  return (
    <div className="gpt:flex gpt:flex-col gpt:justify-center gpt:items-center gpt:h-full">
      <DialogHeader className="gpt:sr-only">
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription />
      </DialogHeader>

      <div className="gpt:rounded-2xl gpt:border gpt:border-gray-200 dark:border-gray-700 gpt:bg-gray-50 dark:bg-gray-800 gpt:p-6 gpt:shadow gpt:w-full gpt:md:w-1/2 gpt:flex gpt:flex-col gpt:gap-6 gpt:justify-center gpt:items-center">
        <section className="gpt:flex gpt:flex-col gpt:justify-center gpt:items-center gpt:gap-4 gpt:text-justify">
          <img src={LOGO} alt="GPT Reader Logo" className="gpt:size-12" />
          <h1 className="gpt:text-xl gpt:font-medium">{title}</h1>
          <p className="gpt:text-sm gpt:text-gray-600 dark:text-gray-300 gpt:text-center">{body}</p>
          <img
            src={GUIDE_IMG}
            alt=""
            className="gpt:w-full gpt:max-w-[1050px] gpt:h-auto gpt:rounded-md gpt:border gpt:border-gray-200 dark:border-gray-700"
          />
        </section>

        <footer className="gpt:flex gpt:items-end gpt:justify-center gpt:gap-4">
          <Button
            variant="ghost"
            className="gpt:border gpt:border-gray-200 dark:border-gray-700 gpt:bg-gray-50 dark:bg-gray-800"
            onClick={onPrimary}
          >
            {primaryLabel}
          </Button>
        </footer>
      </div>
    </div>
  );
};

export default WebReaderPermissionPopup;
