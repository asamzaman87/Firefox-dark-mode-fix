import { Button } from "@/components/ui/button";
import { Popover, PopoverContent } from "@/components/ui/popover";
import { Progress } from "@/components/ui/progress";
import { LISTENERS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { PopoverTrigger } from "@radix-ui/react-popover";
import { DownloadCloud, Loader2, X } from "lucide-react";
import { FC, memo, useCallback, useEffect, useMemo, useRef, useState } from "react";

// Remove <img> (and obvious wrappers) from progressive HTML
const stripImages = (raw: string) => {
  try {
    const doc = new DOMParser().parseFromString(raw, "text/html");
    doc.querySelectorAll("img, picture, figure, svg").forEach((el) => el.remove());
    // Optional: kill inline background images so nothing sneaks in via CSS
    (doc.querySelectorAll("[style]") as NodeListOf<HTMLElement>).forEach((el) => {
      if (el.style?.backgroundImage) el.style.backgroundImage = "";
    });
    return doc.body.innerHTML;
  } catch {
    // Fallback if parsing fails
    return raw.replace(/<img[\s\S]*?>/gi, "");
  }
};

const formatProgress = (p: number): string => {
  // clamp + round to 2 decimals for display
  const v = Math.max(0, Math.min(100, Math.round((Number.isFinite(p) ? p : 0) * 100) / 100));
  // show 2 decimals unless they're both zero
  return Number.isInteger(v) ? v.toFixed(0) : v.toFixed(2);
};


/**
 * Plain viewer that behaves like the old DocumentViewer:
 * - takes a *plain string*
 * - renders it with newlines converted to <br/>
 * - same wrapper classes for identical look/spacing
 */
const DocumentPreview: FC<{ html?: string; text?: string }> = ({ html, text }) => {
  const divRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!divRef.current) return;
    if (html && html.trim().length) {
      divRef.current.innerHTML = stripImages(html);        // ← use progressive HTML
    } else {
      divRef.current.innerHTML = (text ?? "").split("\n").join("<br/>"); // fallback
    }
  }, [html, text]);

  return (
    <div className="gpt:text-[23px] gpt:size-full gpt:overflow-y-auto gpt:max-h-full gpt:text-justify gpt:[&_p]:my-4 gpt:[&_p]:leading-loose gpt:sm:px-[15%]">
      <div ref={divRef} className="gpt:p-10 gpt:mb-32 gpt:bg-white dark:bg-black gpt:min-h-full gpt:h-max gpt:rounded gpt:drop-shadow" />
    </div>
  );
};


interface DownloadPreviewProps {
  progress: number;
  fileName?: string;
  onCancel?: () => void;
  onDownload?: () => void;

  /** Plain preview string (what TTS has processed so far) */
  text: string;

  /** (ignored for download preview — we’re restoring the original plain-text behavior) */
  html?: string;

  downloadCancelConfirmation: boolean;
  setDownloadCancelConfirmation: (state: boolean) => void;
}

const DownloadPreview: FC<DownloadPreviewProps> = ({
  progress,
  onCancel,
  onDownload,
  text,
  html,
  downloadCancelConfirmation,
  setDownloadCancelConfirmation,
}) => {
  const [isConfirmationOpen, setIsConfirmationOpen] = useState<boolean>(false);
  const [hasError, setHasError] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const hasContent = !!(html?.trim() || text?.trim());

  useMemo(() => {
    if (downloadCancelConfirmation) {
      if (hasError) return onCancel?.(); // cancel immediately on error
      setIsConfirmationOpen(true);
    }
  }, [downloadCancelConfirmation, hasError, onCancel]);

  // auto download after 100% progress
  useMemo(() => {
    if (progress === 100) {
      onDownload?.();
      localStorage.removeItem("gptr/download"); // prevent multiple downloads on close
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
    };
  }, [handleError]);

  const toggleConfirmation = useCallback(
    (state: boolean) => {
      if (hasError) return onCancel?.();
      setDownloadCancelConfirmation(state);
      setIsConfirmationOpen(state);
    },
    [setDownloadCancelConfirmation, setIsConfirmationOpen, hasError, onCancel]
  );

  return (
    <div className="gpt:flex gpt:flex-col gpt:items-center gpt:justify-center gpt:size-full gpt:gap-4">
      <div className="gpt:text-center">
        {!hasError && (
          <h1 className="gpt:text-xl gpt:font-bold">
            {progress >= 0 && progress < 100 &&
              `${chrome.i18n.getMessage("downloading_status")} (${formatProgress(progress)}%)`}
            {progress === 100 &&
              `${chrome.i18n.getMessage("download_complete")} (${formatProgress(progress)}%)`}
          </h1>
        )}

        {hasError && (
          <h1 className="gpt:text-xl gpt:font-bold gpt:text-red-600">
            {`${chrome.i18n.getMessage("download_aborted")} (${formatProgress(progress)}%)`}
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
            {progress === 0
              ? chrome.i18n.getMessage("error_no_start")
              : errorMessage}
          </p>
        )}
      </div>

      {/* PREVIEW (restored to original) */}
      <div className="gpt:relative gpt:size-full gpt:overflow-y-auto">
        <span
          className={cn(
            "gpt:z-[1] gpt:rounded-full gpt:text-sm gpt:px-4 gpt:py-2 gpt:text-white dark:text-black gpt:bg-gray-800 dark:bg-gray-100 gpt:absolute gpt:top-4 gpt:right-1/2 gpt:translate-x-1/2 gpt:-translate-y-2 gpt:size-max gpt:inline-flex gpt:justify-center gpt:items-center gpt:gap-2",
            { "gpt:opacity-0 gpt:ease-in-out gpt:transition-all": hasContent }
          )}
        >
          <Loader2 className="gpt:animate-spin" /> {chrome.i18n.getMessage("loading_preview")}
        </span>
        <span
          className={cn(
            "gpt:max-w-lg gpt:rounded-md gpt:z-[1] gpt:text-wrap gpt:text-center gpt:text-sm gpt:font-medium gpt:p-4 gpt:text-white dark:text-black gpt:bg-gray-800 dark:bg-gray-100 gpt:absolute gpt:top-1/2 gpt:right-1/2 gpt:translate-x-1/2 gpt:-translate-y-12 gpt:size-max gpt:inline-flex gpt:justify-center gpt:items-center gpt:gap-2",
            { "gpt:opacity-0 gpt:ease-in-out gpt:transition-all": hasContent }
          )}
        >
          {chrome.i18n.getMessage("gpt4_download_note")}
        </span>

        {/* EXACTLY like the old preview: plain string -> <br/> */}
        <DocumentPreview html={html} text={text} />
      </div>

      <div className="gpt:w-full gpt:sm:px-[15%] gpt:flex gpt:flex-col gpt:gap-4">
        {/* PROGRESS BAR */}
        <div className="gpt:w-full">
          <Progress className="gpt:w-full gpt:h-2 gpt:rounded-sm" value={progress} max={100} />
        </div>

        {/* BUTTON CONTROLS */}
        <div className="gpt:flex gpt:justify-center gpt:gap-4 gpt:flex-col gpt:sm:flex-row">
          {onCancel && progress < 100 && (
            <Popover onOpenChange={toggleConfirmation} open={isConfirmationOpen} modal>
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

export default memo(
  DownloadPreview,
  (p, n) =>
    p.downloadCancelConfirmation === n.downloadCancelConfirmation &&
    p.progress === n.progress &&
    p.text === n.text &&
    p.html === n.html  
);
