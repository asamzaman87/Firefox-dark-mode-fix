import { cn } from "@/lib/utils"

function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-gray-900/10 dark:bg-gray-500/30", className)}
      {...props}
    />
  )
}

export { Skeleton }
