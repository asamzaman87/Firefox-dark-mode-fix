import * as React from "react"

import { cn } from "@/lib/utils"

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "gpt:flex gpt:h-10 gpt:w-full gpt:focus:ring-transparent! gpt:rounded-md gpt:border gpt:border-input gpt:bg-background gpt:px-3 gpt:py-2 gpt:text-base gpt:ring-offset-background gpt:file:border-0 gpt:file:bg-transparent gpt:file:text-sm gpt:file:font-medium gpt:file:text-foreground gpt:placeholder:text-muted-foreground gpt:focus-visible:outline-none gpt:focus-visible:ring-1 gpt:focus-visible:ring-ring gpt:focus-visible:ring-offset-1 gpt:disabled:cursor-not-allowed gpt:disabled:opacity-50 gpt:md:text-sm",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
