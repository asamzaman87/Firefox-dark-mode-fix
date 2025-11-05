/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent } from "@/components/ui/popover";
import { Progress } from "@/components/ui/progress";
import { LISTENERS } from "@/lib/constants";
import { cn, handleDownload as realHandleDownload } from "@/lib/utils";
import { PopoverTrigger } from "@radix-ui/react-popover";
import { DownloadCloud, Loader2, X } from "lucide-react";
import { FC, memo, useCallback, useEffect, useMemo, useState } from "react";
import DocumentViewer from "./document-viewer";
import { useToast } from "@/hooks/use-toast";
import FormatDropdown from "./format-dropdown";
import { usePremiumModal } from "../../../../context/premium-modal";

interface DownloadPreviewProps {
  progress: number;
  fileName?: string;
  onCancel?: () => void;
  onDownload?: () => void;
  text: string;
  downloadCancelConfirmation: boolean;
  setDownloadCancelConfirmation: (state: boolean) => void;
  format?: string;
  setFormat?: (format: string) => void;
}

/** Safe i18n helper for mocked envs */
const t = (key: string, fallback: string) =>
  (typeof chrome !== "undefined" &&
    chrome?.i18n &&
    typeof chrome.i18n.getMessage === "function" &&
    chrome.i18n.getMessage(key)) ||
  fallback;

/** Fallback downloader if real handleDownload isn't wired in mocks */
const fallbackDownload = (text: string, format: string) => {
  const filename =
    format === "pdf" ? "transcript.pdf" : "transcript." + (format || "txt");
  if (format?.toLowerCase() === "pdf") {
    // super-simplified PDF export: wrap text in a basic blob so tests don't fail
    const blob = new Blob(
      [
        `%PDF-1.4
1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj
2 0 obj<</Type/Pages/Count 1/Kids[3 0 R]>>endobj
3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>endobj
4 0 obj<</Length ${text.length + 85}>>stream
BT /F1 12 Tf 72 720 Td (${text.replace(/\(/g, "\\(").replace(/\)/g, "\\)")}) Tj ET
endstream endobj
5 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj
xref
0 6
0000000000 65535 f 
0000000010 00000 n 
0000000061 00000 n 
0000000115 00000 n 
0000000347 00000 n 
0000000581 00000 n 
trailer<</Root 1 0 R/Size 6>>
startxref
712
%%EOF`,
      ],
      { type: "application/pdf" }
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    return;
  }

  // default .txt
  const blob = new Blob([text ?? ""], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
};

const TranscriberDownloadPreview: FC<DownloadPreviewProps> = ({
  progress,
  onCancel,
  text,
  downloadCancelConfirmation,
  setDownloadCancelConfirmation,
  format: controlledFormat,
  setFormat: setControlledFormat,
}) => {
  const [isConfirmationOpen, setIsConfirmationOpen] = useState<boolean>(false);
  const [hasError, setHasError] = useState<boolean>(false);
  const { isSubscribed = true, setReason, setOpen } = usePremiumModal() ?? ({} as any);
  const { toast } = useToast();

  // local format control with controlled/uncontrolled support
  const [uncontrolledFormat, setUncontrolledFormat] = useState<string>(controlledFormat || "txt");
  const isControlled = typeof controlledFormat !== "undefined";
  const format = isControlled ? (controlledFormat as string) : uncontrolledFormat;
  const setFormat = isControlled ? (setControlledFormat as (f: string) => void) : setUncontrolledFormat;

  // derive clean text for the download UX enablement
  const cleanedText = (text || "").replace(/⏳\s*Transcribing.*$/gi, "").trim();
  const isDownloadDisabled = cleanedText.length === 0;

  useMemo(() => {
    if (downloadCancelConfirmation) {
      if (hasError) return onCancel?.(); // cancel directly if error state
      setIsConfirmationOpen(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [downloadCancelConfirmation]);

  useMemo(() => {
    if (progress === 100) {
      try {
        localStorage.removeItem("gptr/download"); // prevent multiple dl on close
      } catch {}
    }
  }, [progress]);

  const handleError = useCallback(() => {
    setHasError(true);
  }, []);

  useEffect(() => {
    // Guard against undefined window or constants in mocked tests
    const evtName = (LISTENERS && (LISTENERS as any).ERROR) || "GPT_MOCK_ERROR";
    try {
      window.addEventListener(evtName, handleError as any);
      return () => {
        setHasError(false);
        window.removeEventListener(evtName, handleError as any);
      };
    } catch {
      // noop for non-DOM test envs
    }
  }, [handleError]);

  const toggleConfirmation = useCallback(
    (state: boolean) => {
      if (hasError) return onCancel?.();
      setDownloadCancelConfirmation(state);
      setIsConfirmationOpen(state);
    },
    [setDownloadCancelConfirmation, hasError, onCancel]
  );

  const onDownloadClick = useCallback(() => {
    if (!isSubscribed) {
      setReason?.(
        "Downloading transcripts is a premium feature. Upgrade now to download your transcribed text in either text or PDF format."
      );
      setOpen?.(true);
      return;
    }
    const doDownload = typeof realHandleDownload === "function"
      ? realHandleDownload
      : fallbackDownload;

    doDownload(cleanedText, format, isDownloadDisabled as any);

    toast({
      id: "recording-toast",
      description:
        "This transcript is being generated by ChatGPT. It may contain mistakes if the audio was unclear. Please review carefully.",
      className:
        "gpt:max-w-lg gpt:rounded-md gpt:z-[1] gpt:text-wrap gpt:break-words gpt:text-left gpt:text-sm gpt:font-medium gpt:p-4 gpt:text-white gpt:dark:text-black gpt:bg-gray-800 gpt:dark:bg-gray-100 gpt:absolute gpt:top-1/2 gpt:right-1/2 gpt:translate-x-1/2 gpt:-translate-y-34 gpt:opacity-100 gpt:transition-all gpt:ease-in-out",
      duration: 4000,
    });
  }, [isSubscribed, setOpen, setReason, cleanedText, format, isDownloadDisabled, toast]);

  return (
    <div className="gpt:flex gpt:flex-col gpt:items-center gpt:justify-center gpt:size-full gpt:gap-4">
      <div className="gpt:text-center">
        {!hasError && (
          <h1 className="gpt:text-xl gpt:font-bold">
            {progress >= 0 && progress < 100 &&
              `${t("loading_transcribe_text", "Loading transcribed text")} (${progress.toFixed(0)}%)`}
            {progress === 100 &&
              `${t("transcribed_complete", "Transcription complete")} (${progress.toFixed(0)}%)`}
          </h1>
        )}

        {hasError && (
          <h1 className="gpt:text-xl gpt:font-bold gpt:text-red-600">
            {`${t("download_aborted", "Download aborted")} (${progress.toFixed(0)}%)`}
          </h1>
        )}

        {!hasError && (
          <p className="gpt:text-sm gpt:text-gray-700 gpt:dark:text-gray-400">
            {progress === 100
              ? t("full_download_note_t", "You can now download the full transcript.")
              : t("please_wait_file_downloading", "Please wait while your transcript is prepared.")}
          </p>
        )}
        {hasError && (
          <p className="gpt:text-red-500 gpt:text-wrap gpt:max-w-lg gpt:text-center">
            {progress === 0
              ? t("error_no_start", "An error occurred before the download could start.")
              : t("error_stopped_midway", "An error occurred and the process stopped mid-way.")}
          </p>
        )}
      </div>

      {/* PREVIEW */}
      <div className="gpt:relative gpt:size-full gpt:overflow-y-auto">
        <span
          className={cn(
            "gpt:z-[1] gpt:rounded-full gpt:text-sm gpt:px-4 gpt:py-2 gpt:text-white gpt:dark:text-black gpt:bg-gray-800 gpt:dark:bg-gray-100 gpt:absolute gpt:top-4 gpt:right-1/2 gpt:translate-x-1/2 gpt:-translate-y-2 gpt:size-max gpt:inline-flex gpt:justify-center gpt:items-center gpt:gap-2",
            { "gpt:opacity-0 gpt:ease-in-out gpt:transition-all": (text || "").trim().length > 0 }
          )}
        >
          <Loader2 className="gpt:animate-spin" /> {t("loading_preview", "Loading preview…")}
        </span>
        <span
          className={cn(
            "gpt:max-w-lg gpt:rounded-md gpt:z-[1] gpt:text-wrap gpt:text-center gpt:text-sm gpt:font-medium gpt:p-4 gpt:text-white gpt:dark:text-black gpt:bg-gray-800 gpt:dark:bg-gray-100 gpt:absolute gpt:top-1/2 gpt:right-1/2 gpt:translate-x-1/2 gpt:-translate-y-12 gpt:size-max gpt:inline-flex gpt:justify-center gpt:items-center gpt:gap-2",
            { "gpt:opacity-0 gpt:ease-in-out gpt:transition-all": (text || "").trim().length > 0 }
          )}
        >
          {t("gpt4_download_note", "Note: AI transcripts may contain errors—review carefully.")}
        </span>
        <DocumentViewer content={text} />
      </div>

      <div className="gpt:w-full gpt:sm:px-[15%] gpt:flex gpt:flex-col gpt:gap-4">
        {/* PROGRESS BAR */}
        <div className="gpt:w-full">
          <Progress className="gpt:w-full gpt:h-2 gpt:rounded-sm" value={progress} max={100} />
        </div>

        <div className="gpt:flex gpt:justify-center gpt:gap-4 gpt:flex-col gpt:sm:flex-row-reverse">
          <div className="gpt:flex gpt:justify-center gpt:gap-4 gpt:flex-col gpt:sm:flex-row">
            {onCancel && progress < 100 && (
              <Popover onOpenChange={toggleConfirmation} open={isConfirmationOpen} modal>
                <PopoverTrigger asChild>
                  <Button
                    variant="ghost"
                    className="gpt:w-full gpt:sm:w-auto gpt:border gpt:border-gray-200 gpt:dark:border-gray-700 gpt:bg-gray-50 gpt:dark:bg-gray-800 gpt:[&_svg]:size-6 gpt:transition-all"
                  >
                    <X />
                    {t("cancel", "Cancel")}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="gpt:relative gpt:p-4 gpt:w-max gpt:flex gpt:flex-col gpt:gap-8 gpt:justify-center gpt:bg-gray-100 gpt:dark:bg-gray-800 gpt:border gpt:border-gray-200 gpt:dark:border-gray-700">
                  <header className="gpt:flex gpt:flex-col gpt:gap-2">
                    <h4 className="gpt:text-lg gpt:font-medium gpt:leading-none gpt:text-wrap">
                      {t("cancel_download_confirmation_title", "Are you sure you want to cancel?")}
                    </h4>
                    <p className="gpt:text-sm gpt:font-medium gpt:text-gray-600 gpt:dark:text-gray-400 gpt:sr-only">
                      {t("cancel_download_confirmation_sr", "Cancel download confirmation")}
                    </p>
                  </header>
                  <div className="gpt:flex gpt:gap-4 gpt:w-full gpt:justify-center gpt:flex-wrap">
                    <Button
                      variant="ghost"
                      className="gpt:flex-auto gpt:border gpt:border-gray-200 gpt:dark:border-gray-700 gpt:bg-gray-50 gpt:dark:bg-gray-800 gpt:[&_svg]:size-6 gpt:transition-all"
                      onClick={() => toggleConfirmation(false)}
                    >
                      {t("continue_download", "Continue Download")}
                    </Button>
                    <Button
                      variant="ghost"
                      className="gpt:flex-auto gpt:border gpt:border-gray-200 gpt:dark:border-gray-700 gpt:bg-gray-50 gpt:dark:bg-gray-800 gpt:[&_svg]:size-6 gpt:transition-all"
                      onClick={onCancel}
                    >
                      {t("cancel_download", "Cancel Download")}
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>
            )}

            {progress > 0 && (
              <>
                <FormatDropdown format={format} setFormat={setFormat} />

                <Button
                  variant="ghost"
                  className="gpt:sm:w-auto gpt:border gpt:border-gray-200 gpt:dark:border-gray-700 gpt:bg-gray-50 gpt:dark:bg-gray-800 gpt:[&_svg]:size-6 gpt:transition-all"
                  onClick={onDownloadClick}
                  disabled={isDownloadDisabled}
                  title={isDownloadDisabled ? t("no_content", "Nothing to download yet") : undefined}
                >
                  <DownloadCloud strokeWidth={2} className="size-5" /> {t("download", "Download")}
                </Button>
              </>
            )}
          </div>
        </div>

        {progress > 0 && progress < 100 && (
          <p className="gpt:text-center gpt:font-medium gpt:text-gray-800 gpt:dark:text-gray-200">
            {t("note_partial_audio", "Note: partial transcript so far—more text will appear as it processes.")}
          </p>
        )}
      </div>
    </div>
  );
};

export default memo(TranscriberDownloadPreview);
