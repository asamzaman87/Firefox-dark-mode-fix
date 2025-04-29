import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Loader2Icon, PauseIcon, PlayIcon, RotateCwIcon } from "lucide-react";
import { FC, useMemo } from "react";
import { FastForwardIcon, RewindIcon } from "./icons";
import PlayRateSlider from "./play-rate-slider";
import Seekbar from "./seekbar";
import VolumeSlider from "./volume-slider";

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

  useMemo(() => {
    if (currentTime > 0 && currentTime !== duration) setPlaybackEnded(false);
  }, [currentTime, duration]);

  const handlePlayPause = () => {
    if (playbackEnded) {
      replay();
      setPlaybackEnded(false);
    }
    if (isPlaying && !playbackEnded) pause();
    if (isPaused && !playbackEnded) play();
  };

  return (
    <div
      className={cn(
        "absolute w-full -bottom-32 left-0 right-0 justify-center items-center flex z-50",
        { "-translate-y-36 transition-transform": showControls }
      )}
    >
      <div
        className={cn(
          "mx-auto size-max flex flex-col justify-evenly items-center gap-0.5 p-2.5 border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 shadow", 
          {"rounded-full": !areSeekControlsAvailable},
          {"rounded-xl": areSeekControlsAvailable}
        )}
      >
        {areSeekControlsAvailable && (
          <Seekbar
            isLoading={isLoading}
            onScrub={onScrub}
            currentTime={currentTime}
            duration={duration}
          />
        )}
        <div className={cn("flex w-full justify-center items-center", { "gap-2": areSeekControlsAvailable, "gap-4": !areSeekControlsAvailable })}>
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
              className="hover:scale-115 active:scale-105 active:-rotate-12 transition-all [&_svg]:size-6 rounded-full"
            >
              <RewindIcon />
            </Button>
          )}
          <Button
            onClick={handlePlayPause}
            size={"icon"}
            variant="ghost"
            className="hover:scale-115 active:scale-105 size-14  transition-all [&_svg]:size-6 rounded-full border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800"
          >
            {!showLoader && isPaused && !playbackEnded && (
              <>
                <PlayIcon />
                <span className="sr-only">Play</span>
              </>
            )}
            {!showLoader && isPlaying && !playbackEnded && (
              <>
                <PauseIcon />
                <span className="sr-only">Pause</span>
              </>
            )}
            {showLoader && <Loader2Icon className="animate-spin size-6" />}
            {!showLoader && playbackEnded && <RotateCwIcon />}
          </Button>
          {areSeekControlsAvailable && (
            <Button
              onClick={onForward}
              disabled={currentTime === duration}
              size={"icon"}
              variant="ghost"
              className="hover:scale-115 active:scale-105 active:rotate-12 transition-all [&_svg]:size-6 rounded-full"
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
