import { Skeleton } from "@/components/ui/skeleton";
import { Slider } from "@/components/ui/slider";
import { usePremiumModal } from "@/context/premium-modal";
import { cn, formatSeconds } from "@/lib/utils";
import { FC, memo, useMemo } from "react";

interface SeekbarProps {
  currentTime: number;
  duration: number;
  isLoading: boolean;
  onScrub: (time: number) => void;
}

const Seekbar: FC<SeekbarProps> = ({
  currentTime = 0,
  duration = 0,
  onScrub
}) => {
  const {isSubscribed, setOpen, setReason} = usePremiumModal();

  const completed = useMemo(
    () => (currentTime / duration) * 100,
    [currentTime, duration]
  );

  const isNotPlaying = useMemo(
    () => currentTime === 0 && duration === 0,
    [currentTime, duration]
  );

  return (
    <div className="gpt:w-full gpt:flex gpt:flex-col gpt:gap-0.5 gpt:justify-between gpt:items-center">
      {isNotPlaying ? (
        <Skeleton className="gpt:animate-pulse gpt:w-full gpt:h-1 gpt:rounded-full gpt:text-white" />
      ) : (
        <Slider
          defaultValue={[0]}
          min={0}
          max={100}
          step={0.1}
          value={[completed]}
          // disabled={!isSubscribed}
          className={cn("gpt:w-full gpt:h-1 gpt:rounded-full", { "gpt:opacity-50": !isSubscribed })}
            onValueChange={(e) => {
              if (!isSubscribed) {
                setReason("You're trying to skip ahead or jump to a specific part of the content using the seek bar, which is a premium feature.");
                setOpen(true);
                return;
              } onScrub(e[0])
            }}
        />
      )}
      <span className="gpt:w-full gpt:inline-flex gpt:justify-between gpt:items-center">
        <span className="gpt:text-[10px] gpt:font-medium gpt:tracking-wider">
          {formatSeconds(currentTime)}
        </span>
        <span className="gpt:text-[10px] gpt:font-medium gpt:tracking-wider">
          {formatSeconds(duration)}
          {/* {!isLoading && formatSeconds(duration)} */}
          {/* {isLoading && (
            <Skeleton className="gpt:animate-pulse gpt:w-8 gpt:h-3 gpt:rounded-full gpt:text-white" />
          )} */}
        </span>
      </span>
    </div>
  );
};

export default memo(
  Seekbar
  // (p, n) => p.currentTime === n.currentTime && p.duration === n.duration && p.isLoading === n.isLoading
);
