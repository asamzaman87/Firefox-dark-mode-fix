import { Button } from "@/components/ui/button";
import { Loader, PauseIcon, PlayIcon } from "lucide-react";
import { FC } from "react";

interface PlayerProps {
    isPaused?: boolean;
    isPlaying?: boolean;
    isLoading?: boolean;
    play: () => void;
    pause: () => void;
    handlePlayRateChange: () => void;
    playRate: number;
}

const Player: FC<PlayerProps> = ({ isPaused, isPlaying, isLoading, play, pause, handlePlayRateChange, playRate }) => {

    return (
        <div className="absolute w-full bottom-4 left-0 right-0 justify-center items-center flex">
            <div className="mx-auto size-max flex justify-evenly items-center gap-2 p-4 border rounded-full border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 shadow">
                {(!isPaused && !isPlaying) || isPaused ? <Button disabled={isLoading} onClick={play} size={"icon"} className="[&_svg]:size-6"><PlayIcon /> <span className="sr-only">Play</span></Button> : null}
                {isLoading ? <Loader className="size-6 animate-spin" /> : null}
                {isPlaying ? <Button onClick={pause} size={"icon"} className="[&_svg]:size-6"><PauseIcon /> <span className="sr-only">Pause</span></Button> : null}
                {isPlaying ? <Button onClick={handlePlayRateChange} size={"icon"} className="rounded-full border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">{playRate}x<span className="sr-only">Playback Rate</span></Button> : null}
            </div>
        </div>
    )
}

export default Player