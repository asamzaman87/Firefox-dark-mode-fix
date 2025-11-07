import * as React from "react"
import * as SliderPrimitive from "@radix-ui/react-slider"

import { cn } from "@/lib/utils"

const Slider = React.forwardRef<
  React.ElementRef<typeof SliderPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root>
>(({ className, ...props }, ref) => (
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
))
Slider.displayName = SliderPrimitive.Root.displayName

export { Slider }
