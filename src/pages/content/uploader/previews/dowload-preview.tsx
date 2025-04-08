import { Button } from "@/components/ui/button";
import { Popover, PopoverContent } from "@/components/ui/popover";
import { Progress } from "@/components/ui/progress";
import { LISTENERS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { PopoverTrigger } from "@radix-ui/react-popover";
import { DownloadCloud, Loader2, X } from "lucide-react";
import { FC, memo, useCallback, useEffect, useMemo, useState } from "react";
import DocumentViewer from "./document-viewer";

interface DownloadPreviewProps {
  progress: number;
  fileName?: string;
  onCancel?: () => void;
  onDownload?: () => void;
  text: string;
  downloadCancelConfirmation: boolean;
  setDownloadCancelConfirmation: (state: boolean) => void;
}

const DownloadPreview: FC<DownloadPreviewProps> = ({
  progress,
  onCancel,
  onDownload,
  text,
  downloadCancelConfirmation,
  setDownloadCancelConfirmation
}) => {
  const [isConfirmationOpen, setIsConfirmationOpen] = useState<boolean>(false);
  const [hasError, setHasError] = useState<boolean>(false);

  useMemo(() => {
    if (downloadCancelConfirmation) {
      if(hasError) return onCancel?.(); //cancels directly without showing confirmation if there is an error
      setIsConfirmationOpen(true)
    }
  }, [downloadCancelConfirmation])

  //auto download after 100% progress
  useMemo(() => {
    if (progress === 100) {
      onDownload?.();
      localStorage.removeItem("gptr/download"); //prevent downloading multiple times on close
    }
  }, [progress, onDownload]);

  const handleError = useCallback(() => {
    setHasError(true);
  }, []);

  useEffect(() => {
    window.addEventListener(LISTENERS.ERROR, handleError);
    return () => {
      setHasError(false);
      window.removeEventListener(LISTENERS.ERROR, handleError);
    }
  }, [])

  const toggleConfirmation = useCallback((state: boolean) => {
    if(hasError) return onCancel?.(); //cancels directly without showing confirmation if there is an error
    setDownloadCancelConfirmation(state);
    setIsConfirmationOpen(state);
  }, [setDownloadCancelConfirmation, setIsConfirmationOpen, hasError, onCancel]);

  return (
    <div className="flex flex-col items-center justify-center size-full gap-4">
      <div className="text-center">
        {!hasError && (
          <h1 className="text-xl font-bold">
            {progress >= 0 &&
              progress < 100 &&
              `${chrome.i18n.getMessage("downloading_status")} (${progress.toFixed(0)}%)`}
            {progress === 100 && `${chrome.i18n.getMessage("download_complete")} (${progress.toFixed(0)}%)`}
          </h1>
        )}

        {hasError && (
          <h1 className="text-xl font-bold text-red-600">
            {`${chrome.i18n.getMessage("download_aborted")} (${progress.toFixed(0)}%)`}
          </h1>
        )}

        {!hasError && (
          <p className="text-sm text-gray-700 dark:text-gray-400">
            {progress === 100
              ? `${chrome.i18n.getMessage("full_download_note")}`
              : `${chrome.i18n.getMessage("please_wait_file_downloading")}`}
          </p>
        )}
        {hasError && (
          <p className="text-red-500 text-wrap max-w-lg text-center">
            {progress === 0 &&
              chrome.i18n.getMessage("error_no_start")}
            {progress > 0 &&
              chrome.i18n.getMessage("error_stopped_midway")}
          </p>
        )}
      </div>

      {/** PREVIEW */}
      <div className="relative size-full overflow-y-auto">
        <span
          className={cn(
            "z-[1] rounded-full text-sm px-4 py-2 text-white dark:text-black bg-gray-800 dark:bg-gray-100 absolute top-4 right-1/2 translate-x-1/2 -translate-y-2 size-max inline-flex justify-center items-center gap-2",
            { "opacity-0 ease-in-out transition-all": text.trim()?.length > 0 }
          )}
        >
          <Loader2 className="animate-spin" /> {chrome.i18n.getMessage("loading_preview")}
        </span>
        <span
          className={cn(
            "max-w-lg rounded-md z-[1] text-wrap text-center text-sm font-medium p-4 text-white dark:text-black bg-gray-800 dark:bg-gray-100 absolute top-1/2 right-1/2 translate-x-1/2 -translate-y-12 size-max inline-flex justify-center items-center gap-2",
            { "opacity-0 ease-in-out transition-all": text.trim()?.length > 0 }
          )}
        >
          {chrome.i18n.getMessage("gpt4_download_note")}
        </span>
        <DocumentViewer content={text} />
      </div>

      <div className="w-full sm:px-[15%] flex flex-col gap-4">
        {/** PROGRESS BAR */}
        <div className="w-full">
          <Progress
            className="w-full h-2 rounded-sm"
            value={progress}
            max={100}
          />
        </div>

        {/** BUTTON CONTROLS */}
        <div className="flex justify-center gap-4 flex-col sm:flex-row">
          {onCancel && progress < 100 && (
            <Popover
              onOpenChange={toggleConfirmation}
              open={isConfirmationOpen}
            >
              <PopoverTrigger asChild>
                <Button
                  variant="ghost"
                  className="w-full sm:w-auto border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 [&_svg]:size-6 transition-all"
                >
                  <X />
                  {chrome.i18n.getMessage("cancel")}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="relative p-4 w-max flex flex-col gap-8 justify-center bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                <header className="flex flex-col gap-2">
                  <h4 className="text-lg font-medium leading-none text-wrap">
                    {chrome.i18n.getMessage("cancel_download_confirmation_title")}
                  </h4>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400 sr-only">
                    {chrome.i18n.getMessage("cancel_download_confirmation_sr")}
                  </p>
                </header>
                <div className="flex gap-4 w-full justify-center flex-wrap">
                  <Button
                    variant="ghost"
                    className="flex-auto border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 [&_svg]:size-6 transition-all"
                    onClick={() => toggleConfirmation(false)}
                  >
                    {chrome.i18n.getMessage("continue_download")}
                  </Button>
                  <Button
                    variant="ghost"
                    className="flex-auto border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 [&_svg]:size-6 transition-all"
                    onClick={onCancel}
                  >
                    {chrome.i18n.getMessage("cancel_download")}
                  </Button>
                </div>
                {/* <Button onClick={() => setIsConfirmationOpen(false)} variant="ghost" size="icon" className="cursor-pointer absolute right-2 top-2 hover:scale-110  rounded-full border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 [&_svg]:size-6 transition-all">
                  <X />
                  <span className="sr-only">Close</span>
                </Button> */}
              </PopoverContent>
            </Popover>
          )}
          {progress > 0 && (
            <Button
              variant="ghost"
              className="w-full sm:w-auto border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 [&_svg]:size-6 transition-all"
              onClick={onDownload}
            >
              <DownloadCloud /> {chrome.i18n.getMessage("download")}
            </Button>
          )}
        </div>
        {progress > 0 && (
          <p className="text-center font-medium text-gray-800 dark:text-gray-200">
            {chrome.i18n.getMessage("note_partial_audio")}
          </p>
        )}
      </div>
    </div>
  );
};

export default memo(DownloadPreview, (p, n) => p.downloadCancelConfirmation === n.downloadCancelConfirmation && p.progress === n.progress);
