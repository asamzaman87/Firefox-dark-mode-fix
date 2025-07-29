import * as React from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { X } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "./button"

const Dialog = DialogPrimitive.Root

const DialogTrigger = DialogPrimitive.Trigger

const DialogPortal = DialogPrimitive.Portal

const DialogClose = DialogPrimitive.Close

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "gpt:fixed gpt:inset-0 gpt:z-50 gpt:bg-black/80 data-[state=open]:gpt:gpt:animate-in data-[state=closed]:gpt:gpt:animate-out data-[state=closed]:gpt:gpt:fade-out-0 data-[state=open]:gpt:gpt:fade-in-0",
      className
    )}
    {...props}
  />
))
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName

interface DialogContentProps
  extends React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> {
  closeButton?: boolean;
}
const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  DialogContentProps
>(({ className, children, closeButton = true, ...props }, ref) => (
  <DialogPortal>
    <DialogOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        "gpt:fixed gpt:left-[50%] gpt:top-[50%] gpt:z-50 gpt:grid gpt:w-full gpt:max-w-lg gpt:translate-x-[-50%] gpt:translate-y-[-50%] gpt:gap-4 gpt:border gpt:bg-background gpt:p-6 gpt:shadow-lg gpt:duration-200 data-[state=open]:gpt:gpt:animate-in data-[state=closed]:gpt:gpt:animate-out data-[state=closed]:gpt:gpt:fade-out-0 data-[state=open]:gpt:gpt:fade-in-0 data-[state=closed]:gpt:gpt:zoom-out-95 data-[state=open]:gpt:gpt:zoom-in-95 data-[state=closed]:gpt:gpt:slide-out-to-left-1/2 data-[state=closed]:gpt:gpt:slide-out-to-top-[48%] data-[state=open]:gpt:gpt:slide-in-from-left-1/2 data-[state=open]:gpt:gpt:slide-in-from-top-[48%] gpt:rounded-none",
        className
      )}
      {...props}
    >
      {children}
      {closeButton &&
        <DialogPrimitive.Close className="gpt:cursor-pointer gpt:absolute gpt:right-4 gpt:top-4">
          <Button variant="ghost" size="icon" className="gpt:hover:scale-115 gpt:active:scale-105 gpt:rounded-full gpt:border gpt:border-gray-200 dark:border-gray-700 gpt:bg-gray-50 dark:bg-gray-800 gpt:[&_svg]:size-6 gpt:transition-all">
            <X />
            <span className="gpt:sr-only">{chrome.i18n.getMessage("close")}</span>
          </Button>
        </DialogPrimitive.Close>
      }
    </DialogPrimitive.Content>
  </DialogPortal>
))
DialogContent.displayName = DialogPrimitive.Content.displayName

const DialogHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "gpt:flex gpt:flex-col gpt:space-y-1.5 gpt:text-center sm:gpt:gpt:text-left",
      className
    )}
    {...props}
  />
)
DialogHeader.displayName = "DialogHeader"

const DialogFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "gpt:flex gpt:flex-col-reverse sm:gpt:gpt:flex-row sm:gpt:gpt:justify-end sm:gpt:gpt:space-x-2",
      className
    )}
    {...props}
  />
)
DialogFooter.displayName = "DialogFooter"

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn(
      "gpt:text-lg gpt:font-semibold gpt:leading-none gpt:tracking-tight",
      className
    )}
    {...props}
  />
))
DialogTitle.displayName = DialogPrimitive.Title.displayName

const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn("gpt:text-sm gpt:text-muted-foreground", className)}
    {...props}
  />
))
DialogDescription.displayName = DialogPrimitive.Description.displayName

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogClose,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
}
