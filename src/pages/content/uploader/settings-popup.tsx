import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DialogProps } from "@radix-ui/react-dialog";
import { FC, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

type SettingsPopupProps = DialogProps & {
  onClose: () => void;
};

const SettingsPopup: FC<SettingsPopupProps> = ({
  open,
  onClose,
  ...props
}) => {
  const [skipRoundBrackets, setSkipRoundBrackets] = useState<boolean>(false);
  const [skipSquareBrackets, setSkipSquareBrackets] = useState<boolean>(false);
  const [skipCurlyBrackets, setSkipCurlyBrackets] = useState<boolean>(false);
  const [skipUrls, setSkipUrls] = useState<boolean>(false);

  // Load settings from localStorage on mount
  useEffect(() => {
    if (open) {
      const roundBrackets = localStorage.getItem("gptr/skipRoundBrackets");
      const squareBrackets = localStorage.getItem("gptr/skipSquareBrackets");
      const curlyBrackets = localStorage.getItem("gptr/skipCurlyBrackets");
      const urls = localStorage.getItem("gptr/skipUrls");

      // Only set to true if the flag exists AND is explicitly "true"
      setSkipRoundBrackets(roundBrackets === "true");
      setSkipSquareBrackets(squareBrackets === "true");
      setSkipCurlyBrackets(curlyBrackets === "true");
      setSkipUrls(urls === "true");
    }
  }, [open]);

  const handleRoundBracketsChange = (checked: boolean) => {
    setSkipRoundBrackets(checked);
    localStorage.setItem("gptr/skipRoundBrackets", String(checked));
  };

  const handleSquareBracketsChange = (checked: boolean) => {
    setSkipSquareBrackets(checked);
    localStorage.setItem("gptr/skipSquareBrackets", String(checked));
  };

  const handleCurlyBracketsChange = (checked: boolean) => {
    setSkipCurlyBrackets(checked);
    localStorage.setItem("gptr/skipCurlyBrackets", String(checked));
  };

  const handleUrlsChange = (checked: boolean) => {
    setSkipUrls(checked);
    localStorage.setItem("gptr/skipUrls", String(checked));
  };

  return (
    <Dialog {...props} open={open} onOpenChange={(open) => {
      if (!open) {
        onClose();
      }
    }}>
      <DialogContent
        onInteractOutside={(e) => {
          e.preventDefault();
        }}
        className="gpt:bg-white gpt:dark:bg-gray-800 gpt:border-none gpt:min-w-[20dvw] gpt:rounded-lg"
      >
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
        </DialogHeader>
        <div className="gpt:flex gpt:flex-col gpt:gap-4 gpt:py-4">
          {/* Round Brackets */}
          <div className="gpt:flex gpt:items-center gpt:justify-between gpt:gap-4">
            <div className="gpt:flex gpt:items-center gpt:gap-3">
              <div className="gpt:w-10 gpt:h-10 gpt:bg-white gpt:dark:bg-gray-700 gpt:rounded-lg gpt:flex gpt:items-center gpt:justify-center gpt:text-lg gpt:font-mono">
                ()
              </div>
              <div className="gpt:flex gpt:flex-col">
                <Label className="gpt:text-base gpt:font-medium">Round Brackets</Label>
                <span className="gpt:text-sm gpt:text-gray-500 gpt:dark:text-gray-400">
                  Skip text in round brackets
                </span>
              </div>
            </div>
            <Switch
              checked={skipRoundBrackets}
              onCheckedChange={handleRoundBracketsChange}
              className="gpt:data-[state=checked]:bg-blue-600 gpt:data-[state=unchecked]:bg-gray-300"
              thumbClassName="gpt:bg-white"
            />
          </div>

          {/* Square Brackets */}
          <div className="gpt:flex gpt:items-center gpt:justify-between gpt:gap-4">
            <div className="gpt:flex gpt:items-center gpt:gap-3">
              <div className="gpt:w-10 gpt:h-10 gpt:bg-white gpt:dark:bg-gray-700 gpt:rounded-lg gpt:flex gpt:items-center gpt:justify-center gpt:text-lg gpt:font-mono">
                []
              </div>
              <div className="gpt:flex gpt:flex-col">
                <Label className="gpt:text-base gpt:font-medium">Square Brackets</Label>
                <span className="gpt:text-sm gpt:text-gray-500 gpt:dark:text-gray-400">
                  Skip text in square brackets
                </span>
              </div>
            </div>
            <Switch
              checked={skipSquareBrackets}
              onCheckedChange={handleSquareBracketsChange}
              className="gpt:data-[state=checked]:bg-blue-600 gpt:data-[state=unchecked]:bg-gray-300"
              thumbClassName="gpt:bg-white"
            />
          </div>

          {/* Curly Brackets */}
          <div className="gpt:flex gpt:items-center gpt:justify-between gpt:gap-4">
            <div className="gpt:flex gpt:items-center gpt:gap-3">
              <div className="gpt:w-10 gpt:h-10 gpt:bg-white gpt:dark:bg-gray-700 gpt:rounded-lg gpt:flex gpt:items-center gpt:justify-center gpt:text-lg gpt:font-mono">
                {"{}"}
              </div>
              <div className="gpt:flex gpt:flex-col">
                <Label className="gpt:text-base gpt:font-medium">Curly Brackets</Label>
                <span className="gpt:text-sm gpt:text-gray-500 gpt:dark:text-gray-400">
                  Skip text in curly brackets
                </span>
              </div>
            </div>
            <Switch
              checked={skipCurlyBrackets}
              onCheckedChange={handleCurlyBracketsChange}
              className="gpt:data-[state=checked]:bg-blue-600 gpt:data-[state=unchecked]:bg-gray-300"
              thumbClassName="gpt:bg-white"
            />
          </div>

          {/* URLs */}
          <div className="gpt:flex gpt:items-center gpt:justify-between gpt:gap-4">
            <div className="gpt:flex gpt:items-center gpt:gap-3">
              <div className="gpt:w-10 gpt:h-10 gpt:bg-white gpt:dark:bg-gray-700 gpt:rounded-lg gpt:flex gpt:items-center gpt:justify-center">
                <svg
                  className="gpt:w-5 gpt:h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
                  />
                </svg>
              </div>
              <div className="gpt:flex gpt:flex-col">
                <Label className="gpt:text-base gpt:font-medium">URLs</Label>
                <span className="gpt:text-sm gpt:text-gray-500 gpt:dark:text-gray-400">
                  Skip URLs
                </span>
              </div>
            </div>
            <Switch
              checked={skipUrls}
              onCheckedChange={handleUrlsChange}
              className="gpt:data-[state=checked]:bg-blue-600 gpt:data-[state=unchecked]:bg-gray-300"
              thumbClassName="gpt:bg-white"
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SettingsPopup;

