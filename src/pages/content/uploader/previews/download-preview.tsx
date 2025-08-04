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
  const [errorMessage, setErrorMessage] = useState<string>('');

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

  const handleError = useCallback((e: CustomEvent<{ message: string }>) => {
    setHasError(true);
    setErrorMessage(e.detail.message || chrome.i18n.getMessage("error_stopped_midway"));
  }, []);


  useEffect(() => {
    window.addEventListener(LISTENERS.ERROR, handleError as EventListener);
    return () => {
      setHasError(false);
      window.removeEventListener(LISTENERS.ERROR, handleError as EventListener);
    }
  }, [])

  const toggleConfirmation = useCallback((state: boolean) => {
    if(hasError) return onCancel?.(); //cancels directly without showing confirmation if there is an error
    setDownloadCancelConfirmation(state);
    setIsConfirmationOpen(state);
  }, [setDownloadCancelConfirmation, setIsConfirmationOpen, hasError, onCancel]);

  return (
    <div className="gpt:flex gpt:flex-col gpt:items-center gpt:justify-center gpt:size-full gpt:gap-4">
      <div className="gpt:text-center">
        {!hasError && (
          <h1 className="gpt:text-xl gpt:font-bold">
            {progress >= 0 &&
              progress < 100 &&
              `${chrome.i18n.getMessage("downloading_status")} (${progress.toFixed(0)}%)`}
            {progress === 100 && `${chrome.i18n.getMessage("download_complete")} (${progress.toFixed(0)}%)`}
          </h1>
        )}

        {hasError && (
          <h1 className="gpt:text-xl gpt:font-bold gpt:text-red-600">
            {`${chrome.i18n.getMessage("download_aborted")} (${progress.toFixed(0)}%)`}
          </h1>
        )}

        {!hasError && (
          <p className="gpt:text-sm gpt:text-gray-700 dark:text-gray-400">
            {progress === 100
              ? `${chrome.i18n.getMessage("full_download_note")}`
              : `${chrome.i18n.getMessage("please_wait_file_downloading")}`}
          </p>
        )}
        {hasError && (
          <p className="gpt:text-red-500 gpt:text-wrap gpt:max-w-lg gpt:text-center">
            {progress === 0 &&
              chrome.i18n.getMessage("error_no_start")}
            {progress > 0 && errorMessage}
          </p>
        )}
      </div>

      {/** PREVIEW */}
      <div className="gpt:relative gpt:size-full gpt:overflow-y-auto">
        <span
          className={cn(
            "gpt:z-[1] gpt:rounded-full gpt:text-sm gpt:px-4 gpt:py-2 gpt:text-white dark:text-black gpt:bg-gray-800 dark:bg-gray-100 gpt:absolute gpt:top-4 gpt:right-1/2 gpt:translate-x-1/2 gpt:-translate-y-2 gpt:size-max gpt:inline-flex gpt:justify-center gpt:items-center gpt:gap-2",
            { "gpt:opacity-0 gpt:ease-in-out gpt:transition-all": text.trim()?.length > 0 }
          )}
        >
          <Loader2 className="gpt:animate-spin" /> {chrome.i18n.getMessage("loading_preview")}
        </span>
        <span
          className={cn(
            "gpt:max-w-lg gpt:rounded-md gpt:z-[1] gpt:text-wrap gpt:text-center gpt:text-sm gpt:font-medium gpt:p-4 gpt:text-white dark:text-black gpt:bg-gray-800 dark:bg-gray-100 gpt:absolute gpt:top-1/2 gpt:right-1/2 gpt:translate-x-1/2 gpt:-translate-y-12 gpt:size-max gpt:inline-flex gpt:justify-center gpt:items-center gpt:gap-2",
            { "gpt:opacity-0 gpt:ease-in-out gpt:transition-all": text.trim()?.length > 0 }
          )}
        >
          {chrome.i18n.getMessage("gpt4_download_note")}
        </span>
        <DocumentViewer content={text} />
      </div>

      <div className="gpt:w-full gpt:sm:px-[15%] gpt:flex gpt:flex-col gpt:gap-4">
        {/** PROGRESS BAR */}
        <div className="gpt:w-full">
          <Progress
            className="gpt:w-full gpt:h-2 gpt:rounded-sm"
            value={progress}
            max={100}
          />
        </div>

        {/** BUTTON CONTROLS */}
        <div className="gpt:flex gpt:justify-center gpt:gap-4 gpt:flex-col gpt:sm:flex-row">
          {onCancel && progress < 100 && (
            <Popover
              onOpenChange={toggleConfirmation}
              open={isConfirmationOpen}
            >
              <PopoverTrigger asChild>
                <Button
                  variant="ghost"
                  className="gpt:w-full gpt:sm:w-auto gpt:border gpt:border-gray-200 dark:border-gray-700 gpt:bg-gray-50 dark:bg-gray-800 gpt:[&_svg]:size-6 gpt:transition-all"
                >
                  <X />
                  {chrome.i18n.getMessage("cancel")}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="gpt:relative gpt:p-4 gpt:w-max gpt:flex gpt:flex-col gpt:gap-8 gpt:justify-center gpt:bg-gray-100 dark:bg-gray-800 gpt:border gpt:border-gray-200 dark:border-gray-700">
                <header className="gpt:flex gpt:flex-col gpt:gap-2">
                  <h4 className="gpt:text-lg gpt:font-medium gpt:leading-none gpt:text-wrap">
                    {chrome.i18n.getMessage("cancel_download_confirmation_title")}
                  </h4>
                  <p className="gpt:text-sm gpt:font-medium gpt:text-gray-600 dark:text-gray-400 gpt:sr-only">
                    {chrome.i18n.getMessage("cancel_download_confirmation_sr")}
                  </p>
                </header>
                <div className="gpt:flex gpt:gap-4 gpt:w-full gpt:justify-center gpt:flex-wrap">
                  <Button
                    variant="ghost"
                    className="gpt:flex-auto gpt:border gpt:border-gray-200 dark:border-gray-700 gpt:bg-gray-50 dark:bg-gray-800 gpt:[&_svg]:size-6 gpt:transition-all"
                    onClick={() => toggleConfirmation(false)}
                  >
                    {chrome.i18n.getMessage("continue_download")}
                  </Button>
                  <Button
                    variant="ghost"
                    className="gpt:flex-auto gpt:border gpt:border-gray-200 dark:border-gray-700 gpt:bg-gray-50 dark:bg-gray-800 gpt:[&_svg]:size-6 gpt:transition-all"
                    onClick={onCancel}
                  >
                    {chrome.i18n.getMessage("cancel_download")}
                  </Button>
                </div>
                {/* <Button onClick={() => setIsConfirmationOpen(false)} variant="ghost" size="icon" className="gpt:cursor-pointer gpt:absolute gpt:right-2 gpt:top-2 hover:gpt:scale-115 active:gpt:scale-105 gpt:rounded-full gpt:border gpt:border-gray-200 dark:border-gray-700 gpt:bg-gray-50 dark:bg-gray-800 [&_svg]:size-6 gpt:transition-all">
                  <X />
                  <span className="gpt:sr-only">Close</span>
                </Button> */}
              </PopoverContent>
            </Popover>
          )}
          {progress > 0 && (
            <Button
              variant="ghost"
              className="gpt:w-full gpt:sm:w-auto gpt:border gpt:border-gray-200 dark:border-gray-700 gpt:bg-gray-50 dark:bg-gray-800 gpt:[&_svg]:size-6 gpt:transition-all"
              onClick={onDownload}
            >
              <DownloadCloud /> {chrome.i18n.getMessage("download")}
            </Button>
          )}
        </div>
        {progress > 0 && (
          <p className="gpt:text-center gpt:font-medium gpt:text-gray-800 dark:text-gray-200">
            {chrome.i18n.getMessage("note_partial_audio")}
          </p>
        )}
      </div>
    </div>
  );
};

export default memo(DownloadPreview, (p, n) => p.downloadCancelConfirmation === n.downloadCancelConfirmation && p.progress === n.progress);
