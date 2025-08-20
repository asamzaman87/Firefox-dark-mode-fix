import { FC } from "react";
import useHybridTranscription from "@/hooks/useHybridTranscription";
import { Button } from "@/components/ui/button";
import { Mic, MicOff, RotateCcw, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { DownloadCloud } from "lucide-react";
import { handleDownload } from "@/lib/utils"; // or wherever your download function is
import { useState } from "react";
import FormatDropdown from "../previews/format-dropdown";
import { usePremiumModal } from "../../../../context/premium-modal";

export interface MicTranscribeFormProps {
  disabled?: boolean;
}

const MicTranscribeForm: FC<MicTranscribeFormProps> = ({ disabled }) => {
  const { isRecording, finalText, loading, start, stop, reset } =
    useHybridTranscription();
  const {isSubscribed, setReason, setOpen} = usePremiumModal();

  const [format, setFormat] = useState("txt");

  const showListening = isRecording && !loading;

  const triggerDownload = () => {
    if (!isSubscribed) {
      setReason(
        "Downloading transcripts is a premium feature. Upgrade now to download your transcribed text in either text or PDF format."
      );
      setOpen(true);
      return;
    }
    handleDownload(finalText, format, !finalText?.trim());
  };

  return (
    <>
      <div className="gpt:flex gpt:justify-center gpt:items-center gpt:gap-4 gpt:w-full">
        <FormatDropdown format={format} setFormat={setFormat} />
        <Button
          variant="ghost"
          className=" gpt:sm:w-auto gpt:border gpt:border-gray-200 gpt:dark:border-gray-700 gpt:bg-gray-50 gpt:dark:bg-gray-800 gpt:[&_svg]:size-6 gpt:transition-all"
          onClick={triggerDownload}
          disabled={!finalText?.trim()}
          aria-label="Download transcript"
        >
          <DownloadCloud strokeWidth={2} className="gpt:size-5" />{" "}
          {chrome.i18n.getMessage("download")}
        </Button>
      </div>

      <div className="gpt:relative gpt:size-full gpt:overflow-y-auto">
        <div className="gpt:text-[23px] gpt:size-full gpt:overflow-y-auto gpt:max-h-full gpt:text-justify gpt:[&_p]:my-4 gpt:[&_p]:leading-loose gpt:sm:px-[15%]">
          <div className="gpt:p-10 gpt:mb-10 gpt:bg-white gpt:dark:bg-black gpt:min-h-full gpt:h-max gpt:rounded gpt:drop-shadow">
            <h4 className="gpt:text-sm gpt:text-muted-foreground gpt:mb-1">Transcript</h4>

            {/* Show the transcript */}
            {finalText && (
              <p className="gpt:whitespace-pre-line gpt:text-lg gpt:font-medium gpt:text-black gpt:dark:text-white">
                {finalText}
              </p>
            )}

            {/* Show "Analyzing with GPT🧠..." only when loading */}
            {loading && (
              <p className="gpt:flex gpt:items-center gpt:gap-2 gpt:text-gray-500 gpt:dark:text-gray-400 gpt:text-lg gpt:italic">
                <Loader2 className="gpt:animate-spin gpt:h-5 gpt:w-5" />
                Analyzing with GPT🧠...
              </p>
            )}

            {/* Show "Listening..." only when recording and not loading */}
            {showListening && (
              <p className="gpt:flex gpt:items-center gpt:gap-2 gpt:text-blue-500 gpt:dark:text-blue-400 gpt:text-lg gpt:italic gpt:mt-4">
                <Mic className="gpt:h-5 gpt:w-5 gpt:animate-pulse" />
                Listening...
              </p>
            )}

            {/* Initial instruction */}
            {!finalText && !isRecording && (
              <p className="gpt:whitespace-pre-line gpt:text-lg gpt:text-black gpt:dark:text-white">
                🎤 Click on the unmute button to start transcribing.
              </p>
            )}
          </div>

          <div className="gpt:sticky gpt:bottom-4 gpt:w-full gpt:flex gpt:justify-center">
            <Button
              onClick={isRecording ? stop : start}
              variant="ghost"
              className={cn(
                "gpt:m-2 gpt:rounded-full gpt:size-16 gpt:shadow-lg gpt:border gpt:border-gray-300 gpt:dark:border-gray-600 gpt:dark:bg-gray-800 gpt:bg-gray-200 gpt:hover:bg-gray-300 gpt:dark:hover:bg-gray-700 gpt:transition-colors gpt:flex gpt:items-center gpt:justify-center",
                isRecording && "animate-pulse border-red-500"
              )}
              disabled={disabled}
              aria-label={isRecording ? "Stop recording" : "Start recording"}
            >
              {isRecording ? <Mic /> : <MicOff className="gpt:text-red-500" />}
            </Button>

            <Button
              variant="ghost"
              onClick={reset}
              className="gpt:m-2 gpt:rounded-full gpt:size-16 gpt:shadow-lg gpt:border gpt:border-gray-300 gpt:dark:border-gray-600 gpt:dark:bg-gray-800 gpt:bg-gray-200 gpt:hover:bg-gray-300 gpt:dark:hover:bg-gray-700 gpt:transition-colors gpt:flex gpt:items-center gpt:justify-center"
              aria-label="Reset transcription"
            >
              <RotateCcw className="gpt:size-5 gpt:text-gray-600 gpt:dark:text-gray-300" />
            </Button>
          </div>
        </div>
      </div>
    </>
  );
};

export default MicTranscribeForm;

