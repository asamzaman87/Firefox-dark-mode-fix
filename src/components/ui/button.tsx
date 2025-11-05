import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "gpt:hover:cursor-pointer gpt:inline-flex gpt:items-center gpt:justify-center gpt:gap-2 gpt:whitespace-nowrap gpt:rounded-md gpt:text-sm gpt:font-medium gpt:ring-offset-background gpt:transition-colors gpt:focus-visible:outline-none gpt:focus-visible:ring-2 gpt:focus-visible:ring-ring gpt:focus-visible:ring-offset-2 gpt:disabled:pointer-events-none gpt:disabled:opacity-50 gpt:[&_svg]:pointer-events-none gpt:[&_svg]:size-4 gpt:[&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "gpt:bg-primary gpt:text-primary-foreground",
        destructive:
          "gpt:bg-destructive gpt:text-destructive-foreground gpt:hover:bg-destructive/90",
        outline:
          "gpt:border gpt:border-input gpt:bg-background gpt:text-primary gpt:hover:bg-gray-100 gpt:hover:text-gray-700 gpt:dark:hover:text-gray-100",
        secondary:
          "gpt:bg-secondary gpt:text-secondary-foreground gpt:hover:bg-secondary/80",
        ghost: "gpt:text-primary gpt:hover:bg-gray-100 gpt:hover:text-gray-700 gpt:dark:hover:bg-gray-700 gpt:dark:hover:text-gray-100",
        link: "gpt:text-primary gpt:underline-offset-4 gpt:hover:underline",
      },
      size: {
        default: "gpt:h-10 gpt:px-4 gpt:py-2",
        sm: "gpt:h-9 gpt:rounded-md gpt:px-3",
        lg: "gpt:h-11 gpt:rounded-md gpt:px-8",
        icon: "gpt:h-10 gpt:w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
