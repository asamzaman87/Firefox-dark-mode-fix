import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { LISTENERS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { ChevronDown, Info, PlayCircle, StopCircle, UserCircle2Icon } from "lucide-react";
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
    const [open, setOpen] = useState<boolean>(false);

    const audio = useMemo(() => new Audio(), []);

    useEffect(() => {
        audio.addEventListener(LISTENERS.AUDIO_ENDED, () => {
            console.log("STOPPING")
            stop()
        })
        return () => {
            stop();
            audio.removeEventListener(LISTENERS.AUDIO_ENDED, () => {
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

    const onDropItemSelect=(voice: string)=>{
        if(audio){
            stop()
        }
        setVoices(voice)
    }

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
        <span aria-disabled={disabled} className="w-max aria-disabled:cursor-not-allowed shadow-sm hover:cursor-pointer inline-flex items-center justify-evenly gap-2 py-1 px-2 text-sm font-medium rounded-full bg-gray-100 dark:bg-gray-800 border border-gray-500 dark:border-gray-700" onClick={onClick}>
            {children}
        </span>
    )

    //if voices not present then fetch them on modal open (happens when user start a new conversation)
    const onOpenChange = (open: boolean) => {
        setOpen(open)
        if (open && voice.voices.length === 0) {
            const voicesEvent = new CustomEvent(LISTENERS.GET_VOICES);
            window.dispatchEvent(voicesEvent);
        }
    }

    return (
        <div className="flex items-center justify-center gap-2">
            <Trigger onClick={() => isPlaying ? stop() : preview()}>
                {!isPlaying && <PlayCircle className={"size-4"} onClick={preview} />}
                {isPlaying && <StopCircle className="size-4" onClick={stop} />}
                {!isPlaying ? "Play Voice" : "Stop"}
            </Trigger>
            <DropdownMenu onOpenChange={onOpenChange}>
                <DropdownMenuTrigger disabled={disabled}>
                    <Trigger disabled={disabled}>
                       <UserCircle2Icon className="size-4"/> {voice.selected.charAt(0).toUpperCase() + voice.selected.slice(1)} <ChevronDown className={cn("size-4", { "rotate-180": open })} />
                    </Trigger>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                    {voices.map((voice) => (
                        <DropdownMenuItem className="items-center justify-between cursor-pointer disabled:cursor-not-allowed hover:bg-gray-200 hover:dark:bg-gray-800/80 rounded" disabled={selected === voice.voice} key={voice.voice} onClick={() => onDropItemSelect(voice.voice)}>
                            {voice.voice.charAt(0).toUpperCase() + voice.voice.slice(1)}
                        </DropdownMenuItem>
                    ))}
                </DropdownMenuContent>
            </DropdownMenu>
            <Popover>
                <PopoverTrigger><Info className="cursor-pointer size-5 text-gray-600 dark:text-gray-100" /></PopoverTrigger>
                <PopoverContent className="bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                    <p className="text-wrap text-justify font-medium text-sm">Choose from a variety of ChatGPT&apos;s enhanced voice options. Please note that the voice selection must be made prior to uploading your text.</p>
                </PopoverContent>
            </Popover>
        </div>
    )

}

export default VoiceSelector