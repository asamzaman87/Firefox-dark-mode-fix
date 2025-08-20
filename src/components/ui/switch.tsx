import * as React from "react"
import * as SwitchPrimitive from "@radix-ui/react-switch"

import { cn } from "@/lib/utils"

function Switch({
  className,
  thumbClassName,
  ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root> & {
  thumbClassName?: string
}) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        "gpt:peer gpt:data-[state=checked]:bg-primary gpt:data-[state=unchecked]:bg-input gpt:focus-visible:border-ring gpt:focus-visible:ring-ring/50 gpt:dark:data-[state=unchecked]:bg-input/80 gpt:inline-flex gpt:h-[1.15rem] gpt:w-8 gpt:shrink-0 gpt:items-center gpt:rounded-full gpt:border gpt:border-transparent gpt:shadow-xs gpt:transition-all gpt:outline-none gpt:focus-visible:ring-[3px] gpt:disabled:cursor-not-allowed gpt:disabled:opacity-50",
        className
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className={cn(
          "gpt:bg-background gpt:dark:data-[state=unchecked]:bg-foreground gpt:dark:data-[state=checked]:bg-primary-foreground gpt:pointer-events-none gpt:block gpt:size-4 gpt:rounded-full gpt:ring-0 gpt:transition-transform gpt:data-[state=checked]:translate-x-[calc(100%-2px)] gpt:data-[state=unchecked]:translate-x-0", thumbClassName
        )}
      />
    </SwitchPrimitive.Root>
  )
}

export { Switch }
