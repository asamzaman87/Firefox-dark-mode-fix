import { Button } from "@/components/ui/button";
import { DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FC, useMemo } from "react";
import { detectBrowser } from "@/lib/utils";

interface WebReaderPermissionPopupProps {
  onPrimary: () => void;
}

const WebReaderPermissionPopup: FC<WebReaderPermissionPopupProps> = ({ onPrimary }) => {
  const LOGO = chrome.runtime.getURL("logo-128.png");

  // Left image (keep filename)
  const GUIDE_IMG_WEB = chrome.runtime.getURL("webreader.png");

  // Right image (browser-specific, keep filenames)
  const GUIDE_IMG_UPLOAD_CHROME = chrome.runtime.getURL("upload-docs-chrome.png");
  const GUIDE_IMG_UPLOAD_FIREFOX = chrome.runtime.getURL("upload-docs-firefox.png");

  const browser = detectBrowser(); // "chrome" | "firefox" | etc.
  const isFirefox = useMemo(() => browser === "firefox", [browser]);

  const title = "Listen to Web Pages or Upload Text";
  const primaryLabel = "Continue";

  const uploadImage = isFirefox ? GUIDE_IMG_UPLOAD_FIREFOX : GUIDE_IMG_UPLOAD_CHROME;

  return (
    <div className="gpt:flex gpt:flex-col gpt:items-center gpt:justify-center gpt:h-full">
      <DialogHeader className="gpt:sr-only">
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription />
      </DialogHeader>

      {/* Taller layout to avoid vertical squeeze */}
      <div className="gpt:w-full gpt:max-w-screen-xl gpt:min-h-[70vh] gpt:max-h-[94vh] gpt:rounded-2xl gpt:border gpt:border-gray-200 dark:border-gray-700 gpt:bg-gray-50 dark:bg-gray-800 gpt:shadow gpt:px-6 gpt:py-6 gpt:flex gpt:flex-col gpt:gap-5">
        {/* Top title */}
        <header className="gpt:flex gpt:flex-col gpt:items-center gpt:text-center gpt:gap-2">
          <img src={LOGO} alt="Fix this Logo" className="gpt:size-12" />
          <h1 className="gpt:text-xl gpt:md:text-2xl gpt:font-medium">{title}</h1>
        </header>

        {/* Two images side-by-side with minimal spacing and their own containers */}
        <div className="gpt:grid gpt:grid-cols-2 gpt:gap-3 gpt:flex-1">
          {/* Left container */}
          <div className="gpt:flex gpt:items-center gpt:justify-center">
            <div className="gpt:w-full gpt:h-full gpt:rounded-xl gpt:border gpt:border-gray-200 dark:border-gray-700 gpt:bg-white dark:bg-gray-900 gpt:p-3 gpt:flex gpt:items-center gpt:justify-center">
              <img
                src={GUIDE_IMG_WEB}
                alt="Select text or full page to send to Fix this"
                className="gpt:w-full gpt:h-full gpt:object-contain gpt:max-h-[64vh] md:gpt:max-h-[70vh]"
              />
            </div>
          </div>

          {/* Right container */}
          <div className="gpt:flex gpt:items-center gpt:justify-center">
            <div className="gpt:w-full gpt:h-full gpt:rounded-xl gpt:border gpt:border-gray-200 dark:border-gray-700 gpt:bg-white dark:bg-gray-900 gpt:p-3 gpt:flex gpt:items-center gpt:justify-center">
              <img
                src={uploadImage}
                alt={isFirefox ? "Upload documents in Firefox" : "Upload documents in Chrome"}
                className="gpt:w-full gpt:h-full gpt:object-contain gpt:max-h-[64vh] md:gpt:max-h-[70vh]"
              />
            </div>
          </div>
        </div>

        {/* Footer button (X/close handled by outer dialog as before) */}
        <footer className="gpt:flex gpt:justify-center">
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
