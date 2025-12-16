import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { usePremiumModal } from "@/context/premium-modal";
import { LISTENERS, PRO_VOICES, TOAST_STYLE_CONFIG_INFO } from "@/lib/constants";
import { cn, detectBrowser } from "@/lib/utils";
import { ArrowDown, Check, ChevronDown, Crown, FileAudio, Info, PlayCircle, Settings, StopCircle, UserCircle2Icon } from "lucide-react";
import { FC, ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useToast } from "../../../hooks/use-toast";
import useFormat from "@/hooks/use-format";
import SettingsPopup from "./settings-popup";

const FILE_TYPES = ["MP3", "OPUS", "AAC"] as const;

export interface Voice {
    selected: string;
    voices: { bloop_color: string, description: string, name: string, preview_url: string, voice: string, gender?: string, premium?: boolean }[];
}

interface VoiceSelectorProps {
    voice: Voice;
    setVoices: (voice: string) => void;
    disabled?: boolean;
    loading?: boolean;
}

const VoiceSelector: FC<VoiceSelectorProps> = ({ voice, setVoices, disabled, loading }) => {
    const { format: fileType, setFormat: setFileType } = useFormat();
    const { selected, voices } = voice;
    const [isPlaying, setIsPlaying] = useState<boolean>(false);
    const [open, setOpen] = useState<boolean>(false);
    const [openSettingsPopup, setOpenSettingsPopup] = useState<boolean>(false);
    const hasInitializedFreeVoice = useRef(false);
    const { setIsTriggered, isSubscribed, setReason } = usePremiumModal();
    const {toast} = useToast();

    // Fire GET_VOICES once on mount if the list is empty (covers inline usage)
    useEffect(() => {
        if (!loading && voice.voices.length === 0) {
            // Wait for injected.js to be ready before dispatching
            const waitAndDispatch = async () => {
                // Wait for injected.js to be ready (max 5 seconds)
                const waitForInjected = (): Promise<boolean> => {
                    return new Promise((resolve) => {
                        if ((window as any).__gptReaderInjectedReady) {
                            resolve(true);
                            return;
                        }
                        const checkInterval = setInterval(() => {
                            if ((window as any).__gptReaderInjectedReady) {
                                clearInterval(checkInterval);
                                resolve(true);
                            }
                        }, 100);
                        setTimeout(() => {
                            clearInterval(checkInterval);
                            resolve(false);
                        }, 5000);
                    });
                };
                await waitForInjected();
                window.dispatchEvent(new CustomEvent(LISTENERS.GET_VOICES));
            };
            waitAndDispatch();
        }
    }, []);

    // Fire GET_VOICES whenever the dropdown opens and voices are still empty
    useEffect(() => {
        if (open && voice.voices.length === 0) {
            // Wait for injected.js to be ready before dispatching
            const waitAndDispatch = async () => {
                const waitForInjected = (): Promise<boolean> => {
                    return new Promise((resolve) => {
                        if ((window as any).__gptReaderInjectedReady) {
                            resolve(true);
                            return;
                        }
                        const checkInterval = setInterval(() => {
                            if ((window as any).__gptReaderInjectedReady) {
                                clearInterval(checkInterval);
                                resolve(true);
                            }
                        }, 100);
                        setTimeout(() => {
                            clearInterval(checkInterval);
                            resolve(false);
                        }, 5000);
                    });
                };
                await waitForInjected();
                window.dispatchEvent(new CustomEvent(LISTENERS.GET_VOICES));
            };
            waitAndDispatch();
        }
    }, [open, voice.voices.length]);

    // Normalize selected to a plain string
    const selectedKey = useMemo(() => {
        if (typeof selected === "string") return selected;
        const v = (selected as any)?.voice;
        return typeof v === "string" ? v : "";
    }, [selected]);

    const selectedLabel = useMemo(() => {
        if (!selectedKey) return "—";
        return selectedKey.charAt(0).toUpperCase() + selectedKey.slice(1);
    }, [selectedKey]);

    
    const allVoices = useMemo(() => {
      const proSet = new Set(PRO_VOICES);
      const enrichedVoices = voices.map((voice) => {
        const isPremium = !isSubscribed && proSet.has(voice.voice);
        return {
          ...voice,
          premium: isPremium,
        };
      });

      return enrichedVoices.sort((a, b) => {
        const sortKey = (v: typeof a) => {
          const premiumValue = v.premium ? 1 : 0;
          const genderRaw = (v.gender || "").toLowerCase();
          const genderValue = genderRaw === "male" ? 0 : genderRaw === "female" ? 2 : 1;
          
          return [premiumValue, genderValue];
        };

        const [aPrem, aGender] = sortKey(a);
        const [bPrem, bGender] = sortKey(b);

        if (aPrem !== bPrem) return aPrem - bPrem;
        return aGender - bGender;
      });
    }, [voices, isSubscribed]);

    const listRef = useRef<HTMLDivElement | null>(null);
    const [showScrollHint, setShowScrollHint] = useState(false);

    useEffect(() => {
        const el = listRef.current;
        if (!el) return;

        const update = () => {
            const canScroll = el.scrollHeight > el.clientHeight;
            // show only if scrollable AND we're at the very top
            setShowScrollHint(canScroll && el.scrollTop === 0);
        };

        update(); // run once on open / data change

        const ro = new ResizeObserver(update);
        ro.observe(el);

        el.addEventListener("scroll", update, { passive: true });

        return () => {
            ro.disconnect();
            el.removeEventListener("scroll", update);
        };
    }, [allVoices.length, open]); // rerun when menu opens or voices change


    useEffect(() => {
        if (
        allVoices.length > 0 && 
        !isSubscribed && 
        !hasInitializedFreeVoice.current
        ) {
            hasInitializedFreeVoice.current = true;

            const selectedVoice = allVoices.find(v => v.voice === selected);
            if (selectedVoice?.premium) {
                const firstFree = allVoices.find(v => !v.premium);
                if (firstFree) {
                    setVoices(firstFree.voice);
                }
            }
        }
    }, [allVoices, isSubscribed, selected, setVoices]);

    useEffect(() => {
      const selectedVoice = allVoices.find((v) => v.voice === selected);
      if (!selectedVoice) return;

      if (!isSubscribed && selectedVoice.premium) {
        setIsTriggered(true);
        setReason(
          "You’ve selected a premium voice, which is part of our upgraded experience. Unlock it by upgrading your plan."
        );
      } else {
        setIsTriggered(false);
        setReason("");
      }
    }, [selected, allVoices, isSubscribed]);

    const audio = useMemo(() => new Audio(), []);

    useEffect(() => {
        audio.addEventListener(LISTENERS.AUDIO_ENDED, () => {
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
        const selectedVoice = allVoices.find((voice) => voice.voice === selected);
        if (!selectedVoice) return;
        const currentPreview = selectedVoice.preview_url;
        if (currentPreview) {
            setIsPlaying(true)
            audio.src = currentPreview;
            audio.play();
        }
    }, [selected, allVoices])

    const onDropItemSelect = (voice: Voice["voices"][number]) => {
      if (voice.premium && !isSubscribed) {
        toast({
          description:
            "You have chosen a premium voice as a free user. GPT Reader allows you to listen to its sample voice but any attempt to listen or download while having it selected will result in a pop-up asking for you to upgrade your membership",
          style: TOAST_STYLE_CONFIG_INFO,
        });
      }
      if (audio) {
        stop();
      }
      setVoices(voice?.voice);
    };

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
        <span
            aria-disabled={disabled}
            onClick={onClick}
            className={cn(
                "gpt:w-max gpt:inline-flex gpt:items-center gpt:justify-evenly gpt:gap-2 gpt:py-1 gpt:px-2 gpt:text-sm gpt:font-medium",
                "gpt:rounded-full gpt:bg-gray-100 gpt:dark:bg-gray-800 gpt:border gpt:border-gray-500 gpt:dark:border-white gpt:shadow-sm",
                "gpt:transition-transform gpt:hover:scale-105 gpt:active:scale-95 gpt:hover:cursor-pointer",
                "gpt:aria-disabled:cursor-not-allowed gpt:flex-shrink-0 gpt:whitespace-nowrap"
            )}
        >
            {children}
        </span>
    )

    //if voices not present then fetch them on modal open (happens when user start a new conversation)
    const onOpenChange = async (open: boolean) => {
        setOpen(open)
        if (open && voice.voices.length === 0) {
            // Wait for injected.js to be ready before dispatching
            const waitForInjected = (): Promise<boolean> => {
                return new Promise((resolve) => {
                    if ((window as any).__gptReaderInjectedReady) {
                        resolve(true);
                        return;
                    }
                    const checkInterval = setInterval(() => {
                        if ((window as any).__gptReaderInjectedReady) {
                            clearInterval(checkInterval);
                            resolve(true);
                        }
                    }, 100);
                    setTimeout(() => {
                        clearInterval(checkInterval);
                        resolve(false);
                    }, 5000);
                });
            };
            await waitForInjected();
            const voicesEvent = new CustomEvent(LISTENERS.GET_VOICES);
            window.dispatchEvent(voicesEvent);
        }
    }

    if (loading || (open && voice.voices.length === 0))
        return (
            <div className="gpt:flex gpt:items-center gpt:justify-center gpt:gap-2">
                <span className="gpt:text-base gpt:font-medium gpt:text-black gpt:dark:text-white">
                    {chrome.i18n.getMessage('loading_voices')}
                </span>
            </div>
        );

    return (
        <div className="gpt:p-1.5 gpt:mx-auto gpt:flex gpt:items-center gpt:justify-center gpt:gap-2 gpt:border gpt:border-gray-500 gpt:dark:border-white gpt:rounded-full gpt:flex-wrap gpt:max-w-full">
            <Trigger onClick={() => isPlaying ? stop() : preview()}>
                {!isPlaying && <PlayCircle className={"gpt:size-4"} onClick={preview} />}
                {isPlaying && <StopCircle className="gpt:size-4" onClick={stop} />}
                {!isPlaying ? chrome.i18n.getMessage('play_voice') : chrome.i18n.getMessage('stop')}
            </Trigger>
            <DropdownMenu onOpenChange={onOpenChange}>
                <DropdownMenuTrigger disabled={disabled}>
                    <Trigger disabled={disabled}>
                        <UserCircle2Icon className="gpt:size-4" /> {selectedLabel} <ChevronDown className={cn("gpt:size-4", { "gpt:rotate-180": open })} />
                    </Trigger>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="gpt:bg-gray-100 gpt:dark:bg-gray-800 gpt:border gpt:border-gray-200 gpt:dark:border-gray-700">
                    <div
                        ref={listRef}
                        className="gpt:relative gpt:max-h-72 gpt:w-full gpt:overflow-y-auto gpt:pr-1"
                    >
                        {allVoices.map((voice, i, arr) => (
                            <>
                                <DropdownMenuItem className="gpt:flex-col gpt:items-start gpt:justify-between gpt:cursor-pointer gpt:disabled:cursor-not-allowed gpt:hover:bg-gray-200 gpt:dark:hover:bg-gray-700 gpt:rounded gpt:gap-1" disabled={selected === voice.voice} key={voice.voice} onClick={() => onDropItemSelect(voice)}>
                                    <div className="gpt:flex gpt:justify-between gpt:items-center gpt:w-full gpt:gap-2">
                                        <span className="gpt:inline-flex gpt:gap-1 gpt:items-center gpt:justify-start">{selected === voice.voice && (<Check className="gpt:w-4 gpt:h-4 gpt:text-gray-600 gpt:dark:text-gray-300" />)}
                                            {voice.voice.charAt(0).toUpperCase() + voice.voice.slice(1)}
                                            {voice.gender &&
                                                <Badge className={cn("gpt:text-xs gpt:font-medium gpt:rounded-full gpt:text-white", { "gpt:bg-blue-800 gpt:dark:bg-blue-700": voice.gender === chrome.i18n.getMessage("male"), "gpt:bg-pink-700 gpt:dark:bg-pink-800": voice.gender === chrome.i18n.getMessage("female") })}>
                                                    {voice.gender}
                                                </Badge>}
                                        </span>
                                        {voice.premium && <Badge
                                            variant="secondary"
                                            className="gpt:text-xs gpt:bg-gradient-to-r gpt:from-amber-500 gpt:to-orange-500 gpt:text-white gpt:border-0 gpt:rounded-full"
                                        >
                                            <Crown className="w-3 h-3 mr-1" />
                                            PRO
                                        </Badge>}
                                    </div>
                                    {voice.description && <p className="gpt:text-xs gpt:text-gray-500 gpt:dark:text-gray-400">{voice.description}</p>}
                                </DropdownMenuItem>
                                {i === arr.length - 1 ? null : <DropdownMenuSeparator className="gpt:bg-gray-200 gpt:dark:bg-gray-700" />}
                            </>
                        ))}
                        {showScrollHint && (
                            <div className="gpt:pointer-events-none gpt:absolute gpt:bottom-2 gpt:left-1/2 gpt:-translate-x-1/2 gpt:flex gpt:items-center gpt:justify-center gpt:gap-2">
                                <span className="gpt:text-sm gpt:font-semibold gpt:px-2 gpt:py-0.5 gpt:rounded-md gpt:bg-white/80 gpt:dark:bg-black/70 gpt:whitespace-nowrap">
                                    <span className="gpt:text-red-500 gpt:animate-pulse">Scroll down</span>
                                </span>
                                <ArrowDown className="gpt:size-8 gpt:animate-bounce gpt:text-red-500" />
                            </div>
                        )}
                    </div>
                </DropdownMenuContent>
            </DropdownMenu>
            <DropdownMenu>
                <DropdownMenuTrigger disabled={disabled}>
                    <Trigger disabled={disabled}>
                        <FileAudio className="gpt:size-4" /> {/* 📄 icon */}
                            {fileType}
                        <ChevronDown className="gpt:size-4" />
                    </Trigger>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="gpt:bg-gray-100 gpt:dark:bg-gray-800 gpt:border gpt:border-gray-200 gpt:dark:border-gray-700">
                    {FILE_TYPES.map((fmt) => (
                        <DropdownMenuItem
                            key={fmt}
                            onClick={() => {
                                setFileType(fmt);
                                if (fmt === "OPUS" && detectBrowser() === "chrome") {
                                    toast({ description: 'Warning: the OPUS format will give you an audio player in the extension without the ability to skip forwards or backwards', style: TOAST_STYLE_CONFIG_INFO });
                                }
                            }}
                            className="gpt:cursor-pointer gpt:hover:bg-gray-200 gpt:dark:hover:bg-gray-700 gpt:rounded"
                        >
                            {fmt}
                        </DropdownMenuItem>
                    ))}
                </DropdownMenuContent>
            </DropdownMenu>
            <Trigger onClick={() => setOpenSettingsPopup(true)}>
                <Settings className="gpt:size-4" /> Text Settings
            </Trigger>
            <Popover>
                <PopoverTrigger><Info className="gpt:cursor-pointer gpt:size-5 gpt:text-gray-600 gpt:dark:text-gray-100" /></PopoverTrigger>
                <PopoverContent className="gpt:bg-gray-100 gpt:dark:bg-gray-800 gpt:border gpt:border-gray-200 gpt:dark:border-gray-700">
                    <p className="gpt:text-wrap gpt:text-left gpt:font-medium gpt:text-sm">{chrome.i18n.getMessage('voice_selector_description')}</p>
                </PopoverContent>
            </Popover>
            <SettingsPopup
                open={openSettingsPopup}
                onClose={() => setOpenSettingsPopup(false)}
            />
        </div>
    )

}

export default VoiceSelector