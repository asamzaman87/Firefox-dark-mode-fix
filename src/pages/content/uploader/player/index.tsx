import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { TOAST_STYLE_CONFIG_INFO } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { InfoIcon, LoaderCircleIcon, PauseIcon, PlayIcon, RotateCwIcon } from "lucide-react";
import { FC, memo, useEffect, useMemo, useRef } from "react";
import PlayRateSlider from "./play-rate-slider";

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
    hasPlayBackEnded?: boolean;
    setHasPlayBackEnded: (state: boolean) => void;
}

const Player: FC<PlayerProps> = ({ isFirstChunk, isPaused, isPlaying, isLoading, play, pause, handlePlayRateChange, playRate, hasPlayBackEnded, setHasPlayBackEnded, showControls }) => {
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
    useMemo(()=>{
        if (!isFirstChunk) {
            if (toastIdRef.current) dismiss(toastIdRef.current);
        }
    },[isFirstChunk])

    useEffect(() => {
        if (showControls) {
            showToast()
        }
        return () => {
            if (toastIdRef.current) dismiss(toastIdRef.current);
        }
    }, [showControls])

    //ToDo: animate like the theme toggle
    return (
        <div className={cn("absolute w-full -bottom-32 left-0 right-0 justify-center items-center flex z-50", { "-translate-y-36 transition-transform": showControls })}>
            <div className="mx-auto size-max flex justify-evenly items-center gap-2 p-4 border rounded-full border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 shadow">
                {isLoading ? <LoaderCircleIcon className="size-6 animate-spin ease-in-out" /> : null}
                {hasPlayBackEnded && (!isPlaying || !isPaused)  ? <Button disabled={isLoading} onClick={restart} size={"icon"} className="hover:scale-110  transition-all [&_svg]:size-6"><RotateCwIcon /> <span className="sr-only">Restart</span></Button> : null}
                {((!isPaused && !isPlaying) || isPaused) && !hasPlayBackEnded && !isFirstChunk && !isLoading ? <Button onClick={play} size={"icon"} className="hover:scale-110  transition-all [&_svg]:size-6"><PlayIcon /> <span className="sr-only">Play</span></Button> : null}
                {isPlaying && !isLoading ? <Button onClick={pause} size={"icon"} className="hover:scale-110  transition-all [&_svg]:size-6"><PauseIcon /> <span className="sr-only">Pause</span></Button> : null}
                {/* {isPlaying || isPaused ? <Button onClick={() => handlePlayRateChange()} disabled={isLoading} size={"icon"} className="hover:scale-110  transition-all rounded-full border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">{playRate}x<span className="sr-only">Playback Rate</span></Button> : null} */}
                {(isPlaying || isPaused) && !isLoading ? <PlayRateSlider playRate={playRate} setPlayRate={(rate) => handlePlayRateChange(false, rate)} disabled={isFirstChunk} /> : null}
            </div>
            <InfoIcon onClick={()=>showToast(5000)} className="hover:cursor-pointer absolute bottom-0 right-4 rounded-full hover:scale-110  transition-all size-6" />
        </div>
    )
}

export default memo(Player)