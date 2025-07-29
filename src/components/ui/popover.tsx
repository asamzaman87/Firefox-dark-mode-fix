import * as React from "react"
import * as PopoverPrimitive from "@radix-ui/react-popover"

import { cn } from "@/lib/utils"

const Popover = PopoverPrimitive.Root

const PopoverTrigger = PopoverPrimitive.Trigger

const PopoverAnchor = PopoverPrimitive.Anchor

interface PopoverContentProps extends React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Content> {}

const PopoverContent = React.forwardRef<
  React.ElementRef<typeof PopoverPrimitive.Content>,
  PopoverContentProps
>(({ className, align = "center", sideOffset = 4, ...props }, ref) => (
  <PopoverPrimitive.Portal>
    <PopoverPrimitive.Content
      ref={ref}
      align={align}
      sideOffset={sideOffset}
      className={cn(
        "gpt:z-50 gpt:w-72 gpt:rounded-md gpt:border gpt:bg-popover gpt:p-4 gpt:text-popover-foreground gpt:shadow-md gpt:outline-none data-[state=open]:gpt:gpt:animate-in data-[state=closed]:gpt:gpt:animate-out data-[state=closed]:gpt:gpt:fade-out-0 data-[state=open]:gpt:gpt:fade-in-0 data-[state=closed]:gpt:gpt:zoom-out-95 data-[state=open]:gpt:gpt:zoom-in-95 data-[side=bottom]:gpt:gpt:slide-in-from-top-2 data-[side=left]:gpt:gpt:slide-in-from-right-2 data-[side=right]:gpt:gpt:slide-in-from-left-2 data-[side=top]:gpt:gpt:slide-in-from-bottom-2",
        className
      )}
      {...props}
    />
  </PopoverPrimitive.Portal>
))
PopoverContent.displayName = PopoverPrimitive.Content.displayName

export { PopoverPrimitive, Popover, PopoverTrigger, PopoverContent, PopoverAnchor }
