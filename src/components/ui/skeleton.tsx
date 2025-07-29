import { cn } from "@/lib/utils"

function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("gpt:animate-pulse gpt:rounded-md gpt:bg-gray-900/10 gpt:dark:bg-gray-500/30", className)}
      {...props}
    />
  )
}

export { Skeleton }
