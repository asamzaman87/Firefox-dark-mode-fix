import * as React from "react"
import * as ToastPrimitives from "@radix-ui/react-toast"
import { cva, type VariantProps } from "class-variance-authority"
import { CircleAlertIcon, X } from "lucide-react"

import { cn } from "@/lib/utils"

const ToastProvider = ToastPrimitives.Provider

interface ToastViewportProps extends React.ComponentPropsWithoutRef<typeof ToastPrimitives.Viewport> {}
const ToastViewport = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Viewport>,
  ToastViewportProps
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Viewport
    ref={ref}
    className={cn(
      "gpt:fixed gpt:bottom-0 gpt:h-max gpt:z-[100] gpt:flex gpt:max-h-screen gpt:w-full gpt:flex-col-reverse gpt:p-4 gpt:sm:bottom-0 gpt:sm:right-0 gpt:sm:top-auto gpt:sm:flex-col gpt:md:max-w-[420px]",
      className
    )}
    {...props}
  />
))
ToastViewport.displayName = ToastPrimitives.Viewport.displayName

const toastVariants = cva(
  "group pointer-events-auto gpt:relative gpt:flex gpt:w-full gpt:items-center gpt:justify-between gpt:space-x-2 gpt:overflow-hidden gpt:rounded-md gpt:border gpt:p-4 gpt:pr-6 gpt:shadow-lg gpt:transition-all data-[swipe=cancel]:translate-x-0 data-[swipe=end]:translate-x-[var(--radix-toast-swipe-end-x)] data-[swipe=move]:translate-x-[var(--radix-toast-swipe-move-x)] data-[swipe=move]:transition-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[swipe=end]:animate-out data-[state=closed]:fade-out-80 data-[state=closed]:slide-out-to-right-full data-[state=open]:slide-in-from-top-full data-[state=open]:sm:slide-in-from-bottom-full",
  {
    variants: {
      variant: {
        default: "gpt:border bg-background text-foreground",
        destructive:
          "destructive group border-destructive bg-destructive text-destructive-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

const Toast = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Root> &
    VariantProps<typeof toastVariants>
>(({ className, variant, ...props }, ref) => {
  return (
    <ToastPrimitives.Root
      ref={ref}
      className={cn(toastVariants({ variant }), className)}
      {...props}
    />
  )
})
Toast.displayName = ToastPrimitives.Root.displayName

interface ToastActionProps extends React.ComponentPropsWithoutRef<typeof ToastPrimitives.Action> {}
const ToastAction = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Action>,
  ToastActionProps
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Action
    ref={ref}
    className={cn(
      "gpt:inline-flex gpt:h-8 gpt:shrink-0 gpt:items-center gpt:justify-center gpt:rounded-md gpt:border gpt:bg-transparent gpt:px-3 gpt:text-sm gpt:font-medium gpt:transition-colors gpt:hover:bg-secondary gpt:focus:outline-none gpt:focus:ring-1 gpt:focus:ring-ring gpt:disabled:pointer-events-none gpt:disabled:opacity-50 group-[.destructive]:gpt:border-muted/40 group-[.destructive]:gpt:hover:border-destructive/30 group-[.destructive]:gpt:hover:bg-destructive group-[.destructive]:gpt:hover:text-destructive-foreground group-[.destructive]:gpt:focus:ring-destructive",
      className
    )}
    {...props}
  />
))
ToastAction.displayName = ToastPrimitives.Action.displayName

interface ToastCloseProps extends React.ComponentPropsWithoutRef<typeof ToastPrimitives.Close> {}
const ToastClose = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Close>,
  ToastCloseProps
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Close
    ref={ref}
    className={cn(
      "gpt:absolute gpt:right-1 gpt:top-1 gpt:rounded-md gpt:text-foreground/50 gpt:transition-opacity gpt:hover:text-foreground gpt:focus:outline-none gpt:focus:ring-1 group-[.destructive]:gpt:text-red-300 group-[.destructive]:gpt:hover:text-red-50 group-[.destructive]:gpt:focus:ring-red-400 group-[.destructive]:gpt:focus:ring-offset-red-600",
      className
    )}
    toast-close=""
    {...props}
  >
    <X className="gpt:h-5 gpt:w-5" />
  </ToastPrimitives.Close>
))
ToastClose.displayName = ToastPrimitives.Close.displayName

interface ToastTitleProps extends React.ComponentPropsWithoutRef<typeof ToastPrimitives.Title> {}
const ToastTitle = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Title>,
  ToastTitleProps
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Title
    ref={ref}
    className={cn("gpt:text-sm gpt:font-semibold [&+div]:text-xs", className)}
    {...props}
  />
))
ToastTitle.displayName = ToastPrimitives.Title.displayName

interface ToastDescriptionProps extends React.ComponentPropsWithoutRef<typeof ToastPrimitives.Description> {}
const ToastDescription = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Description>,
  ToastDescriptionProps
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Description
    ref={ref}
    className={cn("gpt:text-sm gpt:opacity-90 gpt:flex gpt:items-center gpt:gap-4", className)}
    {...props}
  ><CircleAlertIcon className="gpt:size-6"/>
    <div className="gpt:w-full">{props.children}</div>
  </ToastPrimitives.Description>
))
ToastDescription.displayName = ToastPrimitives.Description.displayName

type ToastProps = React.ComponentPropsWithoutRef<typeof Toast>

type ToastActionElement = React.ReactElement<typeof ToastAction>

export {
  type ToastProps,
  type ToastActionElement,
  ToastProvider,
  ToastViewport,
  Toast,
  ToastTitle,
  ToastDescription,
  ToastClose,
  ToastAction,
}
