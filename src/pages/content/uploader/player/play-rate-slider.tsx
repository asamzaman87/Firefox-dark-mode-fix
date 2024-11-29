import { Button } from "@/components/ui/button"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import { Slider } from "@/components/ui/slider"
import { MAX_SLIDER_VALUE, MIN_SLIDER_VALUE, STEP_SLIDER_VALUE } from "@/lib/constants";
import { FC } from "react"

interface PlayRateSliderProps{
    playRate: number;
    setPlayRate: (rate: number) => void;  
    disabled?: boolean;
}

const PlayRateSlider:FC<PlayRateSliderProps> = ({disabled, playRate, setPlayRate}) => {
  return (
    <Popover>
      <PopoverTrigger asChild>
      <Button disabled={disabled} size={"icon"} className="hover:scale-110  transition-all rounded-full border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">{playRate}x</Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 rounded-full border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 shadow">
        <Slider onValueChange={(e)=>setPlayRate(e[0])} min={MIN_SLIDER_VALUE} max={MAX_SLIDER_VALUE} step={STEP_SLIDER_VALUE} disabled={disabled} value={[playRate]}/>
      </PopoverContent>
    </Popover>
  )
}

export default PlayRateSlider;