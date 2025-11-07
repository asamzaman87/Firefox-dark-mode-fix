import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Loader2Icon, Maximize2, Minus, PauseIcon, PlayIcon, RotateCwIcon } from "lucide-react";
import { FC, useCallback, useMemo, useState } from "react";
import { FastForwardIcon, RewindIcon } from "./icons";
import PlayRateSlider from "./play-rate-slider";
import Seekbar from "./seekbar";
import VolumeSlider from "./volume-slider";
import { usePremiumModal } from "@/context/premium-modal";

interface PlayerBackupProps {
  isPaused: boolean;
  isLoading: boolean;
  isPlaying: boolean;
  showControls?: boolean;
  playbackEnded?: boolean;
  partialChunkCompletedPlaying?: boolean;
  volume: number;
  duration: number;
  playRate: number;
  currentTime: number;
  areSeekControlsAvailable: boolean;
  play: () => void;
  pause: () => void;
  replay: () => void;
  onScrub: (time: number) => void;
  onRewind: () => void;
  onForward: () => void;
  setPlaybackEnded: (state: boolean) => void;
  handleVolumeChange: (volume: number, mute?: boolean) => void;
  handlePlayRateChange: (reset?: boolean, rate?: number) => void;
}

const Player: FC<PlayerBackupProps> = ({
  volume,
  isPlaying,
  currentTime,
  duration,
  showControls,
  playRate,
  isLoading,
  isPaused,
  playbackEnded,
  areSeekControlsAvailable,
  partialChunkCompletedPlaying,
  play,
  pause,
  replay,
  onForward,
  onRewind,
  onScrub,
  setPlaybackEnded,
  handleVolumeChange,
  handlePlayRateChange,
}) => {
  const [minimized, setMinimized] = useState<boolean>(false);
  //show loader if not all chunks have completed playing, loading is in progress, current time is 0 and duration is 0 and playback is not ended
  const showLoader = useMemo(
    () =>
      partialChunkCompletedPlaying ||
      (isLoading && !isPlaying && !isPaused && !playbackEnded) ||
      (duration === 0 && currentTime === 0),
    [
      isLoading,
      duration,
      currentTime,
      isPlaying,
      isPaused,
      playbackEnded,
      partialChunkCompletedPlaying,
    ]
  );

  const handlePlayPause = useCallback(() => {
    if (playbackEnded) {
      replay();
      setPlaybackEnded(false);
    }
    if (isPlaying && !playbackEnded) pause();
    if (isPaused && !playbackEnded) play();
  },[replay, pause, play, isPlaying, isPaused, playbackEnded, setPlaybackEnded]);

  const { isSubscribed, setOpen, setReason } = usePremiumModal();

  const attemptForward = () => {
    // if (!isSubscribed) {
    //   setReason("Fast forwarding is a premium feature. Please subscribe to use it.");
    //   setOpen(true);
    //   return;
    // }
    onForward();
  };

  if (minimized) {
    return (
      <div className="gpt:fixed gpt:bottom-4 gpt:left-4 gpt:z-50 gpt:border gpt:border-gray-200 gpt:dark:border-gray-700 gpt:bg-gray-50 gpt:dark:bg-gray-800 gpt:rounded-2xl gpt:py-3 gpt:px-4 gpt:shadow">
        <div className="gpt:w-full gpt:flex gpt:items-center gpt:gap-2">
          <Button
            onClick={handlePlayPause}
            size={"icon"}
            variant="ghost"
            className="gpt:hover:scale-115 gpt:active:scale-105 gpt:size-10 gpt:transition-all gpt:[&_svg]:size-4 gpt:rounded-full gpt:border gpt:border-gray-200 gpt:dark:border-gray-700 gpt:bg-gray-50 gpt:dark:bg-gray-800"
          >
            {!showLoader && isPaused && !playbackEnded && (
              <>
                <PlayIcon />
                <span className="gpt:sr-only">Play</span>
              </>
            )}
            {!showLoader && isPlaying && !playbackEnded && (
              <>
                <PauseIcon />
                <span className="gpt:sr-only">Pause</span>
              </>
            )}
            {showLoader && <Loader2Icon className="gpt:animate-spin gpt:size-6" />}
            {!showLoader && playbackEnded && <RotateCwIcon />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setMinimized(false)}
            aria-label="Maximize player"
            className="gpt:hover:scale-115 gpt:active:scale-105 gpt:size-10 gpt:transition-all gpt:rounded-full"
          >
            <Maximize2 className="gpt:h-5 gpt:w-5" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "gpt:absolute gpt:w-full gpt:-bottom-32 gpt:left-0 gpt:right-0 gpt:justify-center gpt:items-center gpt:flex gpt:z-50",
        { "gpt:-translate-y-36 gpt:transition-transform": showControls }
      )}
    >
      <div
        className={cn(
          "gpt:mx-auto gpt:size-max gpt:flex gpt:flex-col gpt:justify-evenly gpt:items-center gpt:gap-0.5 gpt:p-2.5 gpt:border gpt:border-gray-200 gpt:dark:border-gray-700 gpt:bg-gray-50 gpt:dark:bg-gray-800 gpt:shadow gpt:rounded-xl gpt:relative",
          {"gpt:pt-5 gpt:px-7.5 gpt:pb-2.5": !areSeekControlsAvailable},
          {"gpt:p-2.5": areSeekControlsAvailable},
        )}
      >
        {areSeekControlsAvailable && (
          <div className="gpt:w-full gpt:flex gpt:justify-between gpt:gap-2">
            <Seekbar
              isLoading={isLoading}
              onScrub={onScrub}
              currentTime={currentTime}
              duration={duration}
            />
            <div className="gpt:relative gpt:-top-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setMinimized(true)}
                aria-label="Minimize player"
                className="gpt:size-7 gpt:border gpt:border-gray-200 gpt:dark:border-gray-700 gpt:bg-gray-50 gpt:dark:bg-gray-800"
              >
                <Minus className="gpt:h-5 gpt:w-5" />
              </Button>
            </div>
          </div>
        )}
        {!areSeekControlsAvailable && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setMinimized(true)}
              aria-label="Minimize player"
              className="gpt:absolute gpt:right-1 gpt:top-1 gpt:w-6 gpt:h-5 gpt:border gpt:border-gray-200 gpt:dark:border-gray-700 gpt:bg-gray-50 gpt:dark:bg-gray-800"
            >
              <Minus className="gpt:h-5 gpt:w-5" />
            </Button>
          )}
        <div
          className={cn("gpt:flex gpt:w-full gpt:justify-center gpt:items-center", {
            "gpt:gap-2": areSeekControlsAvailable,
            "gpt:gap-4": !areSeekControlsAvailable,
          })}
        >
          <VolumeSlider
            volume={volume}
            setVolume={(volume) => handleVolumeChange(volume)}
            // disabled={isLoading}
          />
          {areSeekControlsAvailable && (
            <Button
              onClick={onRewind}
              disabled={currentTime === 0}
              size={"icon"}
              variant="ghost"
              className="gpt:hover:scale-115 gpt:active:scale-105 gpt:active:-rotate-12 gpt:transition-all gpt:[&_svg]:size-6 gpt:rounded-full"
            >
              <RewindIcon/>
            </Button>
          )}
          <Button
            onClick={handlePlayPause}
            size={"icon"}
            variant="ghost"
            className="gpt:hover:scale-115 gpt:active:scale-105 gpt:size-14 gpt:transition-all gpt:[&_svg]:size-6 gpt:rounded-full gpt:border gpt:border-gray-200 gpt:dark:border-gray-700 gpt:bg-gray-50 gpt:dark:bg-gray-800"
          >
            {!showLoader && isPaused && !playbackEnded && (
              <>
                <PlayIcon />
                <span className="gpt:sr-only">Play</span>
              </>
            )}
            {!showLoader && isPlaying && !playbackEnded && (
              <>
                <PauseIcon />
                <span className="gpt:sr-only">Pause</span>
              </>
            )}
            {showLoader && <Loader2Icon className="gpt:animate-spin gpt:size-6" />}
            {!showLoader && playbackEnded && <RotateCwIcon />}
          </Button>
          {areSeekControlsAvailable && (
            <Button
              onClick={attemptForward}
              disabled={currentTime === duration}
              size={"icon"}
              variant="ghost"
              className="gpt:hover:scale-115 gpt:active:scale-105 gpt:active:rotate-12 gpt:transition-all gpt:[&_svg]:size-6 gpt:rounded-full"
            >
              <FastForwardIcon />
            </Button>
          )}
          <PlayRateSlider
            playRate={playRate}
            setPlayRate={(rate) => handlePlayRateChange(false, rate)}
          />
        </div>
      </div>
    </div>
  );
};

export default Player;
