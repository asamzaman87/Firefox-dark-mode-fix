import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { LoaderCircleIcon, PauseIcon, PlayIcon, RotateCwIcon } from "lucide-react";
import { FC, memo } from "react";

interface PlayerProps {
    showControls?: boolean;
    isPaused?: boolean;
    isPlaying?: boolean;
    isLoading?: boolean;
    play: () => void;
    pause: () => void;
    handlePlayRateChange: (reset?: boolean) => void;
    playRate: number;
    hasPlayBackEnded?: boolean;
    setHasPlayBackEnded: (state: boolean) => void;
}

const Player: FC<PlayerProps> = ({ isPaused, isPlaying, isLoading, play, pause, handlePlayRateChange, playRate, hasPlayBackEnded, setHasPlayBackEnded, showControls }) => {

    const restart = () => {
        setHasPlayBackEnded(false);
        // handlePlayRateChange(); //true is indicate reset play rate to 1
        play()
    }

    //ToDo: animate like the theme toggle
    return (
        <div className={cn("absolute w-full -bottom-32 left-0 right-0 justify-center items-center flex", { "-translate-y-36 transition-transform": showControls })}>
            <div className="mx-auto size-max flex justify-evenly items-center gap-2 p-4 border rounded-full border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 shadow">
                {isLoading ? <LoaderCircleIcon className="size-6 animate-spin ease-in-out" /> : null}
                {hasPlayBackEnded && (!isPlaying || !isPaused) && !isLoading ? <Button disabled={isLoading} onClick={restart} size={"icon"} className="hover:scale-110  transition-all [&_svg]:size-6"><RotateCwIcon /> <span className="sr-only">Restart</span></Button> : null}
                {((!isPaused && !isPlaying) || isPaused) && !hasPlayBackEnded && !isLoading ? <Button disabled={isLoading} onClick={play} size={"icon"} className="hover:scale-110  transition-all [&_svg]:size-6"><PlayIcon /> <span className="sr-only">Play</span></Button> : null}
                {isPlaying ? <Button onClick={pause} size={"icon"} className="hover:scale-110  transition-all [&_svg]:size-6"><PauseIcon /> <span className="sr-only">Pause</span></Button> : null}
                {isPlaying || isPaused ? <Button onClick={() => handlePlayRateChange()} disabled={isLoading} size={"icon"} className="hover:scale-110  transition-all rounded-full border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">{playRate}x<span className="sr-only">Playback Rate</span></Button> : null}
            </div>
        </div>
    )
}

export default memo(Player)