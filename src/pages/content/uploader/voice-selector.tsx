import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { PlayCircle, StopCircle } from "lucide-react";
import { FC, ReactNode, useCallback, useEffect, useMemo, useState } from "react";

export interface Voice {
    selected: string;
    voices: { bloop_color: string, description: string, name: string, preview_url: string, voice: string }[];
}

interface VoiceSelectorProps {
    voice: Voice;
    setVoices: (voice: string) => void;
    disabled?: boolean;
}

const VoiceSelector: FC<VoiceSelectorProps> = ({ voice, setVoices, disabled }) => {
    const { selected, voices } = voice;
    const [isPlaying, setIsPlaying] = useState<boolean>(false);
    const audio = useMemo(() => new Audio(), []);

    useEffect(() => {
        audio.addEventListener("ended", () => {
            console.log("STOPPING")
            stop()
        })
        return () => {
            audio.removeEventListener("ended", () => {
                stop()
            })
        }
    }, [])

    const preview = useCallback(() => {
        const currentPreview = voices.find((voice) => voice.voice === selected)?.preview_url;
        if (currentPreview) {
            setIsPlaying(true)
            audio.src = currentPreview;
            audio.play();
        }
    }, [selected])

    const stop = useCallback(() => {
        audio.src = "";
        audio.currentTime = 0;
        audio.pause();
        setIsPlaying(false)
    }, [audio])

    interface TriggerProps {
        children: ReactNode;
        onClick?: () => void;
        disabled?: boolean
    }
    const Trigger: FC<TriggerProps> = ({ children, onClick, disabled }) => (
        <span aria-disabled={disabled} className="aria-disabled:cursor-not-allowed w-24 shadow-sm hover:cursor-pointer inline-flex items-center justify-evenly gap-2 py-1 px-2 text-sm font-medium rounded-full bg-gray-100 dark:bg-gray-800 border border-gray-500 dark:border-gray-700" onClick={onClick}>
            {children}
        </span>
    )

    return (
        <div className="flex items-center justify-center gap-2">
            <Trigger onClick={() => isPlaying ? stop() : preview()}>
                {!isPlaying && <PlayCircle className="size-4" onClick={preview} />}
                {isPlaying && <StopCircle className="size-4" onClick={stop} />}
                {!isPlaying ? "Preview" : "Stop"}
            </Trigger>
            <DropdownMenu>
                <DropdownMenuTrigger disabled={disabled || isPlaying}>
                    <Trigger disabled={disabled || isPlaying}>
                        {voice.selected.charAt(0).toUpperCase() + voice.selected.slice(1)}
                    </Trigger>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                    {voices.map((voice) => (
                        <DropdownMenuItem className="items-center justify-between cursor-pointer disabled:cursor-not-allowed hover:bg-gray-200 hover:dark:bg-gray-800/80 rounded" disabled={selected === voice.voice} key={voice.voice} onClick={() => setVoices(voice.voice)}>
                            {voice.voice.charAt(0).toUpperCase() + voice.voice.slice(1)}
                        </DropdownMenuItem>
                    ))}
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
    )

}

export default VoiceSelector