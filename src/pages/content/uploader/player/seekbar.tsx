import { Skeleton } from "@/components/ui/skeleton";
import { Slider } from "@/components/ui/slider";
import { formatSeconds } from "@/lib/utils";
import { FC, memo, useMemo } from "react";

interface SeekbarProps {
  currentTime: number;
  duration: number;
  isLoading: boolean;
  onScrub: (time: number) => void;
}

const Seekbar: FC<SeekbarProps> = ({
  currentTime,
  duration,
  onScrub
}) => {
  const completed = useMemo(
    () => (currentTime / duration) * 100,
    [currentTime, duration]
  );

  const isNotPlaying = useMemo(
    () => currentTime === 0 && duration === 0,
    [currentTime, duration]
  );

  return (
    <div className="w-full flex flex-col gap-0.5 justify-between items-center">
      {isNotPlaying ? (
        <Skeleton className="animate-pulse w-full h-1 rounded-full text-white" />
      ) : (
        <Slider
          defaultValue={[0]}
          min={0}
          max={100}
          step={0.1}
          value={[completed]}
          className="w-full h-1 rounded-full"
          onValueChange={(e) => onScrub(e[0])}
        />
      )}
      <span className="w-full inline-flex justify-between items-center">
        <span className="text-[10px] font-medium tracking-wider">
          {formatSeconds(currentTime)}
        </span>
        <span className="text-[10px] font-medium tracking-wider">
          {formatSeconds(duration)}
          {/* {!isLoading && formatSeconds(duration)} */}
          {/* {isLoading && (
            <Skeleton className="animate-pulse w-8 h-3 rounded-full text-white" />
          )} */}
        </span>
      </span>
    </div>
  );
};

export default memo(
  Seekbar,
  (p, n) => p.currentTime === n.currentTime && p.duration === n.duration && p.isLoading === n.isLoading
);
