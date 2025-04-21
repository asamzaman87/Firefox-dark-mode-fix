import * as SliderPrimitive from "@radix-ui/react-slider";
import * as React from "react";

import { cn, generateRange } from "@/lib/utils";

interface SliderProps extends React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root> { 
  onMarkerClick?: (marker: number) => void; 
  title: string;
  ticks: number[];
  denoter?: string;
}

const Slider = React.forwardRef<
  React.ElementRef<typeof SliderPrimitive.Root>,
  SliderProps
>(({ className, onMarkerClick,title = chrome.i18n.getMessage("playback_speed"), ticks,denoter, ...props }, ref) => {
  const range = React.useMemo(() => generateRange(props.min, props.max, props.step), [props.min, props.max, props.step]);
  // const mid = React.useMemo(() => Math.floor(range.length / 2), [range]);

  return (
    <div>
      <p className="text-lg font-medium text-center mx-auto w-max mb-2.5 text-gray-800 dark:text-gray-100">{title}</p>
      <div className='mb-2.5 flex flex-row justify-between w-full'>
        {range.map((tick) => (
          <span
            key={tick}
            onClick={() => onMarkerClick?.(tick)}
            className={cn('text-sm font-medium transition-opacity cursor-pointer',
              { "px-4" : tick > (props.min ?? 0) && tick < (props.max || 1) },
              { 'text-10 opacity-15': tick > (props.min ?? 0) },
              { "!opacity-100": (props.value?.[0] ?? (props.min ?? 0)) >= tick },
              { "!opacity-100 scale-y-[1.35] -translate-y-[2.5px] transition-transform": tick === (props.value?.[0] ??  (props.min ?? 0)) && tick !==  (props.min ?? 0) && tick !==  (props.max ?? 1) && !ticks.includes(tick) }
            )}
            role='presentation'
          >
            {!ticks.includes(tick) ? "|" : tick+ (denoter ?? "")}
          </span>
        ))}
      </div>
      <SliderPrimitive.Root
        ref={ref}
        className={cn(
          "relative flex w-full touch-none select-none items-center",
          className
        )}
        {...props}
      >
        <SliderPrimitive.Track className="relative h-1 w-full grow overflow-hidden rounded-full bg-black/20! dark:bg-white/20 cursor-pointer">
          <SliderPrimitive.Range className="absolute h-full bg-black dark:bg-white" />
        </SliderPrimitive.Track>
        <SliderPrimitive.Thumb className="block hover:cursor-grab hover:scale-110 active:scale-100 active:cursor-grabbing size-2 rounded-full border dark:border-white/50 border-black/50 dark:bg-white bg-black shadow transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50" />
      </SliderPrimitive.Root>
    </div>
  )
})
Slider.displayName = SliderPrimitive.Root.displayName

export { Slider };

