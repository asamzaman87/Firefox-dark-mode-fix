import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverPrimitive,
  PopoverTrigger
} from "@/components/ui/popover";
import { Slider } from "@/components/ui/slider-with-ticker";
import { MAX_VOLUME_VALUE, MIN_VOLUME_VALUE, STEP_VOLUME_VALUE, VOLUME_TICKS_TO_DISPLAY } from "@/lib/constants";
import { Volume, Volume1Icon, Volume2Icon, VolumeOffIcon, X } from "lucide-react";
import { FC, useMemo } from "react";

interface VolumeSliderProps{
    volume: number;
    setVolume: (rate: number, mute?: boolean) => void;  
    disabled?: boolean;
}

const VolumeSlider:FC<VolumeSliderProps> = ({disabled, volume, setVolume}) => {

  useMemo(()=>{
    if(volume <= 0) setVolume(0, true)
  }, [volume])

  return (
    <Popover modal>
      <PopoverTrigger asChild>
        <Button variant="ghost" disabled={disabled} size={"icon"} className="gpt:hover:scale-115 gpt:active:scale-105 gpt:transition-all gpt:rounded-full gpt:border gpt:border-gray-200 dark:border-gray-700 gpt:bg-gray-50 dark:bg-gray-800">
           {volume === 0 && <VolumeOffIcon/>}
           {volume > 0 && volume <= 0.2 && <Volume/>}
           {volume > 0.2 && volume <= 0.5 && <Volume1Icon/>}
           {volume > 0.5 && <Volume2Icon />}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="gpt:w-max gpt:px-4 gpt:rounded-xl gpt:border-gray-200 dark:border-gray-700 gpt:bg-gray-50 dark:bg-gray-800 gpt:shadow">
        <Slider ticks={VOLUME_TICKS_TO_DISPLAY} title={chrome.i18n.getMessage("volume")} onMarkerClick={(marker)=>setVolume(marker/100)} onValueChange={(e)=>setVolume(e[0]/100)} min={MIN_VOLUME_VALUE} max={MAX_VOLUME_VALUE} step={STEP_VOLUME_VALUE} disabled={disabled} value={[volume*100]}/>
        <PopoverPrimitive.Close className="gpt:absolute gpt:top-2 gpt:right-2" aria-label="Close">
					<X className="gpt:size-6 gpt:p-1 gpt:border gpt:border-gray-200 dark:border-gray-700 gpt:rounded-full" />
				</PopoverPrimitive.Close>
      </PopoverContent>
    </Popover>
  )
}

export default VolumeSlider;