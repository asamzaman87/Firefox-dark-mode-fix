import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { DialogProps } from "@radix-ui/react-dialog";
import { AudioLinesIcon, DownloadCloudIcon } from "lucide-react";
import { FC } from "react";

type InputPopupProps = DialogProps & {
  onSubmit: (action: "DOWNLOAD" | "LISTEN") => void;
};

const options: {
  label: string;
  value: "DOWNLOAD" | "LISTEN";
  icon: React.ReactNode;
  meta?: string
}[] = [
  {
    label: chrome.i18n.getMessage('download'),
    value: "DOWNLOAD",
    icon: <DownloadCloudIcon className="gpt:size-7" aria-hidden="true" />,
    meta: chrome.i18n.getMessage('download_note'),
  },
  {
    label: chrome.i18n.getMessage('listen'),
    value: "LISTEN",
    icon: <AudioLinesIcon className="gpt:size-7" aria-hidden="true" />,
  },
];

const DownloadOrListen: FC<InputPopupProps> = ({ onSubmit, ...props }) => {
  return (
    <Dialog {...props}>
      <DialogTrigger asChild className="gpt:sr-only">
        <Button>Download/Listen</Button>
      </DialogTrigger>
      <DialogContent
        onInteractOutside={(e) => {
          e.preventDefault(); //prevents mask click close
        }}
        className="gpt:bg-gray-100 dark:bg-gray-800 gpt:border-none gpt:min-w-[50dvw] gpt:w-screen md:gpt:w-max"
      >
        <DialogHeader className="gpt:sr-only">
          <DialogTitle>Download or Listen Audio</DialogTitle>
          <DialogDescription>Download or Listen Audio</DialogDescription>
        </DialogHeader>
        <div className="gpt:w-full gpt:space-y-4">
          <div className="gpt:w-full gpt:space-y-1">
            <h1 className="gpt:text-xl gpt:truncate gpt:max-w-[65dvw] md:gpt:max-w-[40dvw]" title="Would you like to download or listen to the audio?">{chrome.i18n.getMessage('would_you_like_to_download_or_listen')} </h1>
            {/* <p className="gpt:text-gray-500 gpt:text-sm">
              Would you like to download or listen to the audio?
            </p> */}
          </div>

          <div className="gpt:flex gpt:flex-col gpt:gap-5">
            {options.map((option, index) => (
              <div
                onClick={() => onSubmit(option.value)}
                key={index}
                className={cn(
                  "group gpt:relative gpt:grid gpt:size-full gpt:cursor-pointer gpt:place-items-center gpt:rounded-2xl gpt:border-2 gpt:border-dashed gpt:border-gray-500 gpt:dark:hover:border-gray-200 hover:border-gray-700 gpt:p-5 gpt:text-center gpt:transition hover:bg-gray-200 dark:hover:bg-gray-700",
                  "gpt:ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                )}
              >
                <div className="gpt:flex gpt:flex-col gpt:items-center gpt:justify-center gpt:gap-2 sm:gpt:px-5 gpt:cursor-pointer">
                  <div className="gpt:rounded-full gpt:border gpt:border-gray-500 gpt:border-dashed gpt:flex gpt:items-center gpt:justify-center gpt:size-20">
                    {option.icon}
                  </div>
                  <div className="gpt:flex gpt:flex-col gpt:items-end gpt:justify-center gpt:gap-px gpt:align-middle">
                    <p className="gpt:font-medium gpt:text-center gpt:w-full">{option.label}</p>
                    {option.meta && <p className="gpt:text-sm gpt:text-gray-600 dark:text-gray-400 gpt:text-center gpt:text-wrap gpt:w-full">({option.meta})</p>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default DownloadOrListen;
