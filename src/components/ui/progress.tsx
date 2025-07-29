import * as React from "react";
import * as ProgressPrimitive from "@radix-ui/react-progress";

import { cn } from "@/lib/utils";

const Progress = React.forwardRef<
  React.ElementRef<typeof ProgressPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root>
>(({ className, value, ...props }, ref) => (
  <ProgressPrimitive.Root
    ref={ref}
    className={cn(
      "gpt:relative gpt:h-4 gpt:w-full gpt:overflow-hidden gpt:rounded-md dark:bg-gray-700/50 gpt:bg-gray-200",
      className
    )}
    {...props}
  >
    <ProgressPrimitive.Indicator
      className={cn(
        "gpt:h-full gpt:w-full gpt:flex-1 dark:bg-gray-100 gpt:bg-gray-800 gpt:transition-all",
        { "gpt:bg-green-600 dark:bg-green-600": value === 100 }
      )}
      style={{ transform: `translateX(-${100 - (value || 0)}%)` }}
    />
  </ProgressPrimitive.Root>
));
Progress.displayName = ProgressPrimitive.Root.displayName;

export { Progress };
