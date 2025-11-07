import * as SliderPrimitive from "@radix-ui/react-slider";
import * as React from "react";

import { cn, generateRange } from "@/lib/utils";

interface SliderProps extends React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root> {
  onMarkerClick?: (marker: number) => void;
  title: string;
  ticks: number[];
  denoter?: string;
  // Optional locking logic
  isTickLocked?: (tick: number) => boolean;
  onLockedClick?: () => void;
}

const Slider = React.forwardRef<
  React.ElementRef<typeof SliderPrimitive.Root>,
  SliderProps
>(({ className, onMarkerClick, title = chrome.i18n.getMessage("playback_speed"), ticks, denoter, isTickLocked, onLockedClick, ...props }, ref) => {
  const range = React.useMemo(() => generateRange(props.min, props.max, props.step), [props.min, props.max, props.step]);
  // const mid = React.useMemo(() => Math.floor(range.length / 2), [range]);

  return (
    <div>
      <p className="gpt:text-lg gpt:font-medium gpt:text-center gpt:mx-auto gpt:w-max mb-2.5 gpt:text-gray-800 gpt:dark:text-gray-100">{title}</p>
      <div className='gpt:mb-2.5 gpt:flex gpt:flex-row gpt:justify-between gpt:w-full'>
        {range.map((tick) => {
          const locked = isTickLocked?.(tick) ?? false;
          return (
            <span
              key={tick}
              onClick={() => {
                if (locked) {
                  onLockedClick?.();
                  return;
                }
                onMarkerClick?.(tick);
              }}
              className={cn('gpt:text-sm gpt:font-medium gpt:transition-opacity gpt:cursor-pointer',
                { "gpt:px-4": tick > (props.min ?? 0) && tick < (props.max || 1) },
                { 'gpt:text-10 gpt:opacity-15': tick > (props.min ?? 0) },
                { "gpt:!opacity-100": (props.value?.[0] ?? (props.min ?? 0)) >= tick },
                { "gpt:!opacity-100 gpt:scale-y-[1.35] gpt:-translate-y-[2.5px] gpt:transition-transform": tick === (props.value?.[0] ?? (props.min ?? 0)) && tick !== (props.min ?? 0) && tick !== (props.max ?? 1) && !ticks.includes(tick) },
                { "gpt:opacity-40 gpt:cursor-not-allowed": locked }
              )}
              role='presentation'
            >
              {!ticks.includes(tick) ? "|" : tick + (denoter ?? "")}
            </span>
          )
        })}
      </div>
      <SliderPrimitive.Root
        ref={ref}
        className={cn(
          "gpt:relative gpt:flex gpt:w-full gpt:touch-none gpt:select-none gpt:items-center",
          className
        )}
        {...props}
      >
        <SliderPrimitive.Track className="gpt:relative gpt:h-1 gpt:w-full gpt:grow gpt:overflow-hidden gpt:rounded-full gpt:bg-black/20! gpt:dark:bg-white/20 gpt:cursor-pointer">
          <SliderPrimitive.Range className="gpt:absolute gpt:h-full gpt:bg-black gpt:dark:bg-white" />
        </SliderPrimitive.Track>
        <SliderPrimitive.Thumb className="gpt:block gpt:hover:cursor-grab gpt:hover:scale-110 gpt:active:scale-100 gpt:active:cursor-grabbing gpt:size-2 gpt:rounded-full gpt:border gpt:dark:border-white/50 gpt:border-black/50 gpt:dark:bg-white gpt:bg-black gpt:shadow gpt:transition-colors gpt:focus-visible:outline-none gpt:focus-visible:ring-1 gpt:focus-visible:ring-ring gpt:disabled:pointer-events-none gpt:disabled:opacity-50" />
      </SliderPrimitive.Root>
    </div>
  )
})
Slider.displayName = SliderPrimitive.Root.displayName

export { Slider };

