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
    label: "Download",
    value: "DOWNLOAD",
    icon: <DownloadCloudIcon className="size-7" aria-hidden="true" />,
    meta: "Subject to be behind a paywall in the future",
  },
  {
    label: "Listen",
    value: "LISTEN",
    icon: <AudioLinesIcon className="size-7" aria-hidden="true" />,
  },
];

const DownloadOrListen: FC<InputPopupProps> = ({ onSubmit, ...props }) => {
  return (
    <Dialog {...props}>
      <DialogTrigger asChild className="sr-only">
        <Button>Download/Listen</Button>
      </DialogTrigger>
      <DialogContent
        onInteractOutside={(e) => {
          e.preventDefault(); //prevents mask click close
        }}
        className="bg-gray-100 dark:bg-gray-800 border-none min-w-[50dvw] w-screen md:w-max"
      >
        <DialogHeader className="sr-only">
          <DialogTitle>Download or Listen Audio</DialogTitle>
          <DialogDescription>Download or Listen Audio</DialogDescription>
        </DialogHeader>
        <div className="w-full space-y-4">
          <div className="w-full space-y-1">
            <h1 className="text-xl truncate max-w-[65dvw] md:max-w-[40dvw]" title="Would you like to download or listen to the audio?">Would you like to download or listen to the audio? </h1>
            {/* <p className="text-gray-500 text-sm">
              Would you like to download or listen to the audio?
            </p> */}
          </div>

          <div className="flex flex-col gap-5">
            {options.map((option, index) => (
              <div
                onClick={() => onSubmit(option.value)}
                key={index}
                className={cn(
                  "group relative grid size-full cursor-pointer place-items-center rounded-2xl border-2 border-dashed border-gray-500 dark:hover:border-gray-200 hover:border-gray-700 p-5 text-center transition hover:bg-gray-200 dark:hover:bg-gray-700",
                  "ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                )}
              >
                <div className="flex flex-col items-center justify-center gap-2 sm:px-5 cursor-pointer">
                  <div className="rounded-full border border-gray-500 border-dashed flex items-center justify-center size-20">
                    {option.icon}
                  </div>
                  <div className="flex flex-col items-end justify-center gap-px align-middle">
                    <p className="font-medium text-center w-full">{option.label}</p>
                    {option.meta && <p className="text-sm text-gray-600 dark:text-gray-400 text-center text-wrap w-full">({option.meta})</p>}
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
