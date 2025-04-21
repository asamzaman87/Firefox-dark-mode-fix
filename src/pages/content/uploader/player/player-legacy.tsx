import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { TOAST_STYLE_CONFIG_INFO } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { InfoIcon, LoaderCircleIcon, PauseIcon, PlayIcon, RotateCwIcon } from "lucide-react";
import { FC, memo, useEffect, useMemo, useRef } from "react";
import { FastForwardIcon, RewindIcon } from "./icons";
import PlayRateSlider from "./play-rate-slider";
import Seekbar from "./seekbar";
import VolumeSlider from "./volume-slider";

interface PlayerProps {
    showControls?: boolean;
    isPaused?: boolean;
    isPlaying?: boolean;
    isLoading?: boolean;
    isFirstChunk?: boolean;
    play: () => void;
    pause: () => void;
    handlePlayRateChange: (reset?: boolean, rate?: number) => void;
    playRate: number;
    handleVolumeChange: (volume: number, mute?: boolean) => void;
    volume: number;
    hasPlayBackEnded?: boolean;
    setHasPlayBackEnded: (state: boolean) => void;
    onForward?: () => void;
    onRewind?: () => void;
    duration: number;
    currentTime: number;
}

const PlayerLegacy: FC<PlayerProps> = ({ duration, currentTime, handleVolumeChange, volume, onForward, onRewind, isFirstChunk, isPaused, isPlaying, isLoading, play, pause, handlePlayRateChange, playRate, hasPlayBackEnded, setHasPlayBackEnded, showControls }) => {
    const toastIdRef = useRef<string | null>(null); // Provide the type (string) for useRef
    const { toast, dismiss } = useToast();

    const restart = () => {
        setHasPlayBackEnded(false);
        // handlePlayRateChange(); //true is indicate reset play rate to 1
        play()
    }

    const showToast = (duration: number = 70000, description: string = "GPT Reader may generate audio that is not a 100% accurate. If you start to notice differences then it is recommended to close the overlay and create a new ChatGPT chat and try using the GPT Reader extension again.") => {
        const { id } = toast({
            description,
            style: { ...TOAST_STYLE_CONFIG_INFO, fontWeight: "600" },
            duration
        })
        toastIdRef.current = id;
    }

    //show warning popup on the first chunk only
    useMemo(() => {
        if (!isFirstChunk) {
            if (toastIdRef.current) dismiss(toastIdRef.current);
        }
    }, [isFirstChunk])

    useEffect(() => {
        if (showControls) {
            showToast()
        }
        return () => {
            if (toastIdRef.current) dismiss(toastIdRef.current);
        }
    }, [showControls])


    return (
        <div className={cn("absolute w-full -bottom-32 left-0 right-0 justify-center items-center flex z-50", { "-translate-y-36 transition-transform": showControls })}>
            <div className={cn("mx-auto size-max flex flex-col justify-evenly items-center gap-0.5 p-2.5 border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 shadow", { "rounded-full": (!isPlaying && !isPaused) || hasPlayBackEnded, "rounded-xl": (isPlaying || isPaused) && !hasPlayBackEnded })}>
                {isLoading ? <LoaderCircleIcon className="size-6 animate-spin ease-in-out" /> : null}
                {hasPlayBackEnded && (!isPlaying || !isPaused) ? <Button disabled={isLoading} onClick={restart} size={"icon"} className="hover:scale-115 active:scale-105  transition-all [&_svg]:size-6"><RotateCwIcon /> <span className="sr-only">Restart</span></Button> : null}

                {(isPlaying || isPaused) && !isLoading && !hasPlayBackEnded &&
                    <Seekbar isLoading={!!isLoading} onScrub={()=>{}} currentTime={currentTime} duration={duration} />
                }

                {(isPlaying || isPaused) && !isLoading &&
                    <div className="w-full flex justify-evenly gap-2 items-center">
                        {(isPlaying || isPaused) && !isLoading && !hasPlayBackEnded &&
                            <VolumeSlider volume={volume} setVolume={(volume) => handleVolumeChange(volume,)} disabled={isLoading} />
                        }

                        {(isPlaying || isPaused) && !isLoading && !hasPlayBackEnded &&
                            <Button onClick={onRewind} size={"icon"} className="hover:scale-115 active:scale-105  transition-all [&_svg]:size-6">
                                <RewindIcon />
                            </Button>
                        }

                        {((!isPaused && !isPlaying) || isPaused) && !hasPlayBackEnded && !isFirstChunk && !isLoading ? <Button onClick={play} size={"icon"} className="hover:scale-115 active:scale-105 size-14  transition-all [&_svg]:size-6 rounded-full border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800"><PlayIcon /> <span className="sr-only">Play</span></Button> : null}
                        {isPlaying && !isLoading && !hasPlayBackEnded ? <Button onClick={pause} size={"icon"} className="hover:scale-115 active:scale-105 size-14  transition-all [&_svg]:size-6 rounded-full border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800"><PauseIcon /> <span className="sr-only">Pause</span></Button> : null}

                        {(isPlaying || isPaused) && !isLoading && !hasPlayBackEnded &&
                            <Button onClick={onForward} size={"icon"} className="hover:scale-115 active:scale-105  transition-all [&_svg]:size-6">
                                <FastForwardIcon />
                            </Button>
                        }

                        {/* {isPlaying || isPaused ? <Button onClick={() => handlePlayRateChange()} disabled={isLoading} size={"icon"} className="hover:scale-115 active:scale-105  transition-all rounded-full border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">{playRate}x<span className="sr-only">Playback Rate</span></Button> : null} */}
                        {(isPlaying || isPaused) && !isLoading && !hasPlayBackEnded ?
                            <PlayRateSlider playRate={playRate} setPlayRate={(rate) => handlePlayRateChange(false, rate)} disabled={isFirstChunk} />
                            : null}
                    </div>
                }
            </div>
            <InfoIcon onClick={() => showToast(5000)} className="hover:cursor-pointer absolute bottom-0 right-4 rounded-full hover:scale-115 active:scale-105  transition-all size-6" />
        </div>
    )
}

export default memo(PlayerLegacy)