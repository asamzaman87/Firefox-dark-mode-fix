import { FC } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
} from "../../../components/ui/dialog";
import {
  DialogDescription,
  DialogProps,
  DialogTitle,
} from "@radix-ui/react-dialog";
import { Button } from "../../../components/ui/button";
import { CheckCircleIcon, Sparkles } from "lucide-react";

interface TrialGiftProps extends DialogProps {
  onClose: (value: boolean) => void;
  trialEndsAt: number | null;
}

const formatEnd = (ts: number | null) => {
  if (!ts) return "";
  try {
    const d = new Date(ts);
    return d.toLocaleString();
  } catch {
    return "";
  }
};

const TrialGiftPopUp: FC<TrialGiftProps> = ({ open, onClose, trialEndsAt, ...props }) => {
  const LOGO = chrome.runtime.getURL("logo-128.png");

  const onOpenChange = (nextOpen: boolean) => {
    // Keep parity with Pin popup behavior (no accidental close via backdrop)
    if (!nextOpen) onClose(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange} {...props}>
      <DialogContent
        onInteractOutside={(e) => {
          // Match Pin popup: block backdrop click
          e.preventDefault();
        }}
        className="gpt:bg-gray-50 dark:bg-gray-800 gpt:border-none gpt:w-[95vw] gpt:max-w-[95vw] gpt:sm:w-[95vw] gpt:sm:max-w-[620px] gpt:md:w-[80vw] gpt:md:max-w-[750px] lg:gpt:w-[60vw] lg:gpt:max-w-[800px] xl:gpt:max-w-[900px] gpt:rounded-2xl"
      >
        <DialogHeader className="gpt:sr-only">
          <DialogTitle className="gpt:inline-flex gpt:flex-col gpt:justify-center gpt:items-center gpt:gap-2">
            {chrome.i18n.getMessage("are_you_sure")}
          </DialogTitle>
          <DialogDescription className="gpt:sr-only">Description</DialogDescription>
        </DialogHeader>

        <div className="gpt:w-full gpt:flex gpt:flex-col gpt:gap-6 gpt:justify-center gpt:items-center">
          <section className="gpt:flex gpt:flex-col gpt:justify-center gpt:items-center gpt:gap-4 gpt:text-justify">
            <img src={LOGO} alt="GPT Reader Logo" className="gpt:size-12" />

            <h1 className="gpt:text-xl gpt:font-medium gpt:text-center">
              🎁 Enjoy Your 24-Hour Premium Trial 🎁
            </h1>

            {/* Subheader card, mirrors Premium modal tone */}
            <div className="gpt:border gpt:border-gray-200 gpt:dark:border-gray-700 gpt:bg-white gpt:dark:bg-gray-700 gpt:rounded-lg gpt:p-3 gpt:mt-4 gpt:max-w-[720px]">
              <div className="gpt:flex gpt:items-start gpt:gap-2">
                <Sparkles className="w-4 h-4 mt-0.5 flex-shrink-0 text-amber-600 dark:text-amber-500" />
                <div className="gpt:text-left">
                  <p className="gpt:text-sm gpt:text-gray-700 gpt:dark:text-gray-200">
                    You’ve unlocked <span className="gpt:font-medium">all Premium features</span> for the next 24 hours.
                    {trialEndsAt ? (
                      <>
                        {" "}
                        <span className="gpt:font-medium">Trial ends:</span> {formatEnd(trialEndsAt)}
                      </>
                    ) : null}
                  </p>
                </div>
              </div>
            </div>

            {/* Feature list with check marks (same icon as Premium modal) */}
            <ul className="gpt:space-y-2 gpt:text-sm gpt:mt-2 gpt:max-w-[720px]">
              <li className="gpt:flex gpt:items-start">
                <span className="gpt:mr-2 gpt:mt-0.5">
                  <CheckCircleIcon />
                </span>
                <span>All free features included</span>
              </li>
              <li className="gpt:flex gpt:items-start">
                <span className="gpt:mr-2 gpt:mt-0.5">
                  <CheckCircleIcon />
                </span>
                <span>Audio player with advanced controls</span>
              </li>
              <li className="gpt:flex gpt:items-start">
                <span className="gpt:mr-2 gpt:mt-0.5">
                  <CheckCircleIcon />
                </span>
                <span>Text-to-speech downloads with <b>no character limit</b></span>
              </li>
              <li className="gpt:flex gpt:items-start">
                <span className="gpt:mr-2 gpt:mt-0.5">
                  <CheckCircleIcon />
                </span>
                <span>Download while listening to uploaded text</span>
              </li>
              <li className="gpt:flex gpt:items-start">
                <span className="gpt:mr-2 gpt:mt-0.5">
                  <CheckCircleIcon />
                </span>
                <span>Download transcribed text as <b>.txt</b> or <b>.pdf</b></span>
              </li>
              <li className="gpt:flex gpt:items-start">
                <span className="gpt:mr-2 gpt:mt-0.5">
                  <CheckCircleIcon />
                </span>
                <span>Smoother playback & faster chunking</span>
              </li>
            </ul>
          </section>

          <footer className="gpt:flex gpt:items-end gpt:justify-center gpt:gap-4">
            <Button
              variant={"ghost"}
              size={"lg"}
              className="gpt:border gpt:border-gray-200 dark:border-gray-700 gpt:bg-gray-50 dark:bg-gray-800 gpt:[&_svg]:size-6 gpt:transition-all"
              onClick={() => onClose(false)}
            >
              Okay
            </Button>
          </footer>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default TrialGiftPopUp;
