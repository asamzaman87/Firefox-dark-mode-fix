import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "gpt:inline-flex gpt:items-center gpt:rounded-md gpt:border gpt:px-2.5 gpt:py-0.5 gpt:text-xs gpt:font-semibold gpt:transition-colors gpt:focus:outline-none gpt:focus:ring-2 gpt:focus:ring-ring gpt:focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "gpt:border-transparent gpt:bg-primary gpt:text-primary-foreground gpt:shadow gpt:hover:bg-primary/80",
        secondary:
          "gpt:border-transparent gpt:bg-secondary gpt:text-secondary-foreground gpt:hover:bg-secondary/80",
        destructive:
          "gpt:border-transparent gpt:bg-destructive gpt:text-destructive-foreground gpt:shadow gpt:hover:bg-destructive/80",
        outline: "gpt:text-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
