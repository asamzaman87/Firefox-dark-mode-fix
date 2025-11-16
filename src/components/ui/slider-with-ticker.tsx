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
  const min = props.min ?? 0;
  const max = props.max ?? 1;
  const rangeSpan = max - min;
  const current = Math.min(props.value?.[0] ?? min, max);

  // Calculate position percentage for each tick (same calculation Radix uses for thumb)
  const getTickPosition = (tickValue: number): string => {
    // Clamp ticks within [min, max] so e.g. volume label 100 aligns with max track end (when max=99)
    const clamped = Math.max(min, Math.min(tickValue, max));
    const percentage = ((clamped - min) / rangeSpan) * 100;
    return `${percentage}%`;
  };

  return (
    <div>
      <p className="gpt:text-lg gpt:font-medium gpt:text-center gpt:mx-auto gpt:w-max mb-2.5 gpt:text-gray-800 gpt:dark:text-gray-100">{title}</p>
      <div className='gpt:mb-2.5 gpt:relative gpt:w-full gpt:h-7'>
        {range.map((tick) => {
          const locked = isTickLocked?.(tick) ?? false;
          const isLabeledTick = ticks.includes(tick);
          const position = getTickPosition(tick);
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
              style={{ 
                left: position, 
                transform: tick === current && tick !== min && tick !== max && !ticks.includes(tick)
                  ? 'translateX(-50%) translateY(-2.5px) scaleY(1.35)'
                  : 'translateX(-50%)'
              }}
              className={cn('gpt:absolute gpt:transition-opacity gpt:cursor-pointer gpt:flex gpt:flex-col gpt:items-center gpt:transition-transform gpt:select-none',
                // highlight ticks up to current (clamped), dim ticks after current
                { "gpt:!opacity-100": Math.min(Math.max(tick, min), max) <= current },
                { "gpt:opacity-30": Math.min(Math.max(tick, min), max) > current },
                { "gpt:opacity-40 gpt:cursor-not-allowed": locked }
              )}
              role='presentation'
            >
              {/* baseline marker line (consistent width regardless of label length) */}
              <span className="gpt:block gpt:w-px gpt:h-3 gpt:bg-current gpt:mb-0.5" />
              {/* label (does not affect position/spacing) */}
              {isLabeledTick && (
                (() => {
                  const label = `${tick}${denoter ?? ""}`;
                  const dotIndex = label.indexOf(".");
                  // Shift label so the decimal point aligns directly under the tick center.
                  // Use monospace to make 'ch' a good approximation for per-char width.
                  const needsDotCentering = dotIndex >= 0;
                  // Compute offset in ch units so that decimal is centered:
                  // delta = dotIndex - (len - 1)/2
                  const delta = needsDotCentering ? (dotIndex - (label.length - 1) / 2) : 0;
                  return (
                    <span
                      className="gpt:text-[11px] gpt:leading-none gpt:whitespace-nowrap gpt:font-mono"
                      style={needsDotCentering ? { transform: `translateX(${-delta}ch)` } : undefined}
                    >
                      {label}
                    </span>
                  );
                })()
              )}
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
        <SliderPrimitive.Thumb className="gpt:block hover:gpt:cursor-grab hover:gpt:scale-110 active:gpt:scale-100 active:gpt:cursor-grabbing gpt:size-2 gpt:rounded-full gpt:border gpt:dark:border-white/50 gpt:border-black/50 gpt:dark:bg-white gpt:bg-black gpt:shadow gpt:transition-colors focus-visible:gpt:outline-none focus-visible:gpt:ring-1 focus-visible:gpt:ring-ring disabled:gpt:pointer-events-none disabled:gpt:opacity-50" />
      </SliderPrimitive.Root>
    </div>
  )
})
Slider.displayName = SliderPrimitive.Root.displayName

export { Slider };

