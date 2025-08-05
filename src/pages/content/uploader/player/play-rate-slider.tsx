import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
  PopoverPrimitive
} from "@/components/ui/popover"
import { Slider } from "@/components/ui/slider-with-ticker"
import { MAX_SLIDER_VALUE, MIN_SLIDER_VALUE, STEP_SLIDER_VALUE, TICKS_TO_DISPLAY, MAX_PLAYBACK_RATE } from "@/lib/constants";
import { X } from "lucide-react";
import { FC } from "react"
import { usePremiumModal } from "../../../../context/premium-modal";

interface PlayRateSliderProps {
  playRate: number;
  setPlayRate: (rate: number) => void;
  disabled?: boolean;
}

const PlayRateSlider: FC<PlayRateSliderProps> = ({ disabled, playRate, setPlayRate }) => {
  const { isSubscribed, setOpen, setReason } = usePremiumModal();

  const triggerPremiumModal = () => {
    setReason(
      `You're trying to access a premium playback feature. Speeds above ${MAX_PLAYBACK_RATE}x require a premium plan.`
    );
    setOpen(true);
  };
  
  return (
    <Popover modal>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          disabled={disabled}
          size={"icon"}
          className="gpt:hover:scale-115 gpt:active:scale-105 gpt:transition-all gpt:rounded-full gpt:border gpt:border-gray-200 dark:border-gray-700 gpt:bg-gray-50 dark:bg-gray-800"
        >
          {playRate}x
        </Button>
      </PopoverTrigger>
      <PopoverContent className="gpt:w-max gpt:px-4 gpt:rounded-xl gpt:border-gray-200 dark:border-gray-700 gpt:bg-gray-50 dark:bg-gray-800 gpt:shadow">
        <Slider
          denoter="x"
          ticks={TICKS_TO_DISPLAY}
          title={chrome.i18n.getMessage("playback_speed")}
          onValueChange={(val) => {
            const rate = val[0];
            if (!isSubscribed && rate > MAX_PLAYBACK_RATE) {
              triggerPremiumModal();
              return;
            }
            setPlayRate(rate);
          }}
          onMarkerClick={(marker) => {
            if (!isSubscribed && marker > MAX_PLAYBACK_RATE) {
              triggerPremiumModal();
              return;
            }
            setPlayRate(marker);
          }}
          isTickLocked={(tick) => !isSubscribed && tick > MAX_PLAYBACK_RATE}
          onLockedClick={() => triggerPremiumModal()}
          min={MIN_SLIDER_VALUE}
          max={MAX_SLIDER_VALUE}
          step={STEP_SLIDER_VALUE}
          disabled={disabled}
          value={[playRate]}
        />
        <PopoverPrimitive.Close
          className="gpt:absolute gpt:top-2 gpt:right-2"
          aria-label="Close"
        >
          <X className="gpt:size-6 gpt:p-1 gpt:border gpt:border-gray-200 gpt:dark:border-gray-700 gpt:rounded-full" />
        </PopoverPrimitive.Close>
      </PopoverContent>
    </Popover>
  );
}

export default PlayRateSlider;