import * as React from "react"
import * as TooltipPrimitive from "@radix-ui/react-tooltip"

import { cn } from "@/lib/utils"

const TooltipProvider = TooltipPrimitive.Provider

const Tooltip = TooltipPrimitive.Root

const TooltipTrigger = TooltipPrimitive.Trigger

const TooltipContent = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(({ className, sideOffset = 4, ...props }, ref) => (
  <TooltipPrimitive.Portal>
    <TooltipPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      className={cn(
        "gpt:z-50 gpt:overflow-hidden gpt:rounded-md gpt:bg-primary gpt:px-3 gpt:py-1.5 gpt:text-xs gpt:text-primary-foreground gpt:animate-in gpt:fade-in-0 gpt:zoom-in-95 data-[state=closed]:gpt:gpt:animate-out data-[state=closed]:gpt:gpt:fade-out-0 data-[state=closed]:gpt:gpt:zoom-out-95 data-[side=bottom]:gpt:gpt:slide-in-from-top-2 data-[side=left]:gpt:gpt:slide-in-from-right-2 data-[side=right]:gpt:gpt:slide-in-from-left-2 data-[side=top]:gpt:gpt:slide-in-from-bottom-2",
        className
      )}
      {...props}
    />
  </TooltipPrimitive.Portal>
))
TooltipContent.displayName = TooltipPrimitive.Content.displayName

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider }
