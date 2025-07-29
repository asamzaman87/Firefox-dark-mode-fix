import * as React from "react"

import { cn } from "@/lib/utils"

const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.ComponentProps<"textarea">
>(({ className, ...props }, ref) => {
  return (
    <textarea
      className={cn(
        "gpt:min-h-[80px] gpt:focus:ring-transparent! gpt:flex gpt:h-10 gpt:w-full gpt:rounded-md gpt:border gpt:border-input gpt:bg-background gpt:px-3 gpt:py-2 gpt:text-base gpt:ring-offset-background gpt:file:border-0 gpt:file:bg-transparent gpt:file:text-sm gpt:file:font-medium gpt:file:text-foreground gpt:placeholder:text-muted-foreground gpt:focus-visible:outline-none gpt:focus-visible:ring-2 gpt:focus-visible:ring-ring gpt:focus-visible:ring-offset-2 gpt:disabled:cursor-not-allowed gpt:disabled:opacity-50 gpt:md:text-sm",
        className
      )}
      ref={ref}
      {...props}
    />
  )
})
Textarea.displayName = "Textarea"

export { Textarea }