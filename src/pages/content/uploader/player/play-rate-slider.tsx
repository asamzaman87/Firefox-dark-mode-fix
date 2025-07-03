import { Button } from "@/components/ui/button"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
    PopoverPrimitive
} from "@/components/ui/popover"
import { Slider } from "@/components/ui/slider-with-ticker"
import { MAX_SLIDER_VALUE, MIN_SLIDER_VALUE, STEP_SLIDER_VALUE, TICKS_TO_DISPLAY } from "@/lib/constants";
import { X } from "lucide-react";
import { FC } from "react"

interface PlayRateSliderProps{
    playRate: number;
    setPlayRate: (rate: number) => void;  
    disabled?: boolean;
}

const PlayRateSlider:FC<PlayRateSliderProps> = ({disabled, playRate, setPlayRate}) => {
  return (
    <Popover modal>
      <PopoverTrigger asChild>
      <Button variant="ghost" disabled={disabled} size={"icon"} className="hover:scale-115 active:scale-105 transition-all rounded-full border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">{playRate}x</Button>
      </PopoverTrigger>
      <PopoverContent className="w-max px-4 rounded-xl border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 shadow">
        <Slider denoter="x" ticks={TICKS_TO_DISPLAY} title={chrome.i18n.getMessage("playback_speed")} onMarkerClick={(marker)=>setPlayRate(marker)} onValueChange={(e)=>setPlayRate(e[0])} min={MIN_SLIDER_VALUE} max={MAX_SLIDER_VALUE} step={STEP_SLIDER_VALUE} disabled={disabled} value={[playRate]}/>
        <PopoverPrimitive.Close className="absolute top-2 right-2" aria-label="Close">
					<X className="size-6 p-1 border border-gray-200 dark:border-gray-700 rounded-full" />
				</PopoverPrimitive.Close>
      </PopoverContent>
    </Popover>
  )
}

export default PlayRateSlider;