import { FC } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../../../components/ui/dialog";
import { Clock, Download } from "lucide-react";

interface TimerProps {
  open: boolean;
  onClose: () => void;
  timeLeft: number;
}

const TimerPopup: FC<TimerProps> = ({ open, onClose, timeLeft }) => {
  // Format time in MM:SS format
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs
      .toString()
      .padStart(2, "0")}`;
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent
        closeButton={false}
        onInteractOutside={(e: Event) => {
          e.preventDefault();
        }}
        className="gpt:bg-gray-50 gpt:dark:bg-gray-800 gpt:rounded-2xl gpt:sm:max-w-md"
      >
        <DialogHeader className="gpt:text-center">
          <DialogTitle className="gpt:flex gpt:items-center gpt:justify-center gpt:gap-2 gpt:text-xl">
            <Download className="w-5 h-5" />
            Preparing Your Download
          </DialogTitle>
          <DialogDescription className="gpt:text-gray-600 gpt:text-center">
            Your audio will be downloaded once the timer reaches zero
          </DialogDescription>
        </DialogHeader>

        <div className="gpt:flex gpt:flex-col gpt:items-center gpt:space-y-6 gpt:py-6">
          {/* Timer Display */}
          <div className="gpt:relative">
            <div className="gpt:w-24 gpt:h-24 gpt:rounded-full gpt:border-4 gpt:border-gray-200 gpt:flex gpt:items-center gpt:justify-center gpt:bg-gradient-to-br gpt:from-green-50 gpt:to-green-100">
              <span className="gpt:text-2xl gpt:font-bold gpt:text-green-600 gpt:tabular-nums">
                {formatTime(timeLeft)}
              </span>
            </div>
            <div className="gpt:absolute gpt:inset-0 gpt:rounded-full gpt:border-4 gpt:border-green-500 gpt:border-t-transparent gpt:animate-spin"></div>
          </div>

          {/* Upgrade Message */}
          <div className="gpt:text-center gpt:space-y-2 gpt:px-4">
            <div className="gpt:flex gpt:items-center gpt:justify-center gpt:gap-2 gpt:text-sm">
              <Clock className="gpt:w-4 gpt:h-4" />
              <span>Free users: Standard download queue</span>
            </div>
            <p className="gpt:text-sm gpt:text-muted-foreground">
              {`Consider upgrading in the future if you don't want to wait.`}
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default TimerPopup;
