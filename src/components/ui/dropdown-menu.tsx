import * as React from "react"
import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu"
import { Check, ChevronRight, Circle } from "lucide-react"

import { cn } from "@/lib/utils"

const DropdownMenu = DropdownMenuPrimitive.Root

const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger

const DropdownMenuGroup = DropdownMenuPrimitive.Group

const DropdownMenuPortal = DropdownMenuPrimitive.Portal

const DropdownMenuSub = DropdownMenuPrimitive.Sub

const DropdownMenuRadioGroup = DropdownMenuPrimitive.RadioGroup

const DropdownMenuSubTrigger = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.SubTrigger>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.SubTrigger> & {
    inset?: boolean
  }
>(({ className, inset, children, ...props }, ref) => (
  <DropdownMenuPrimitive.SubTrigger
    ref={ref}
    className={cn(
      "gpt:flex gpt:cursor-default gpt:gap-2 gpt:select-none gpt:items-center gpt:rounded-sm gpt:px-2 gpt:py-1.5 gpt:text-sm gpt:outline-none gpt:focus:bg-accent gpt:data-[state=open]:bg-accent [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
      inset && "gpt:pl-8",
      className
    )}
    {...props}
  >
    {children}
    <ChevronRight className="gpt:ml-auto" />
  </DropdownMenuPrimitive.SubTrigger>
))
DropdownMenuSubTrigger.displayName =
  DropdownMenuPrimitive.SubTrigger.displayName

const DropdownMenuSubContent = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.SubContent>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.SubContent>
>(({ className, ...props }, ref) => (
  <DropdownMenuPrimitive.SubContent
    ref={ref}
    className={cn(
      "gpt:z-50 gpt:min-w-[8rem] gpt:overflow-hidden gpt:rounded-md gpt:border gpt:bg-popover gpt:p-1 gpt:text-popover-foreground gpt:shadow-lg gpt:data-[state=open]:animate-in gpt:data-[state=closed]:animate-out gpt:data-[state=closed]:fade-out-0 gpt:data-[state=open]:fade-in-0 gpt:data-[state=closed]:zoom-out-95 gpt:data-[state=open]:zoom-in-95 gpt:data-[side=bottom]:slide-in-from-top-2 gpt:data-[side=left]:slide-in-from-right-2 gpt:data-[side=right]:slide-in-from-left-2 gpt:data-[side=top]:slide-in-from-bottom-2",
      className
    )}
    {...props}
  />
))
DropdownMenuSubContent.displayName =
  DropdownMenuPrimitive.SubContent.displayName

const DropdownMenuContent = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Content>
>(({ className, sideOffset = 4, ...props }, ref) => (
  <DropdownMenuPrimitive.Portal>
    <DropdownMenuPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      className={cn(
        "gpt:z-50 gpt:min-w-[8rem] gpt:overflow-hidden gpt:rounded-md gpt:border gpt:bg-popover gpt:p-1 gpt:text-popover-foreground gpt:shadow-md",
        "gpt:data-[state=open]:animate-in gpt:data-[state=closed]:animate-out gpt:data-[state=closed]:fade-out-0 gpt:data-[state=open]:fade-in-0 gpt:data-[state=closed]:zoom-out-95 gpt:data-[state=open]:zoom-in-95 gpt:data-[side=bottom]:slide-in-from-top-2 gpt:data-[side=left]:slide-in-from-right-2 gpt:data-[side=right]:slide-in-from-left-2 gpt:data-[side=top]:slide-in-from-bottom-2",
        className
      )}
      {...props}
    />
  </DropdownMenuPrimitive.Portal>
))
DropdownMenuContent.displayName = DropdownMenuPrimitive.Content.displayName

const DropdownMenuItem = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Item> & {
    inset?: boolean
  }
>(({ className, inset, ...props }, ref) => (
  <DropdownMenuPrimitive.Item
    ref={ref}
    className={cn(
      "gpt:relative gpt:flex gpt:cursor-default gpt:select-none gpt:items-center gpt:gap-2 gpt:rounded-sm gpt:px-2 gpt:py-1.5 gpt:text-sm gpt:outline-none gpt:transition-colors gpt:focus:bg-accent gpt:focus:text-accent-foreground gpt:data-[disabled]:pointer-events-none gpt:data-[disabled]:opacity-50 [&>svg]:size-4 [&>svg]:shrink-0",
      inset && "gpt:pl-8",
      className
    )}
    {...props}
  />
))
DropdownMenuItem.displayName = DropdownMenuPrimitive.Item.displayName

const DropdownMenuCheckboxItem = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.CheckboxItem>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.CheckboxItem>
>(({ className, children, checked, ...props }, ref) => (
  <DropdownMenuPrimitive.CheckboxItem
    ref={ref}
    className={cn(
      "gpt:relative gpt:flex gpt:cursor-default gpt:select-none gpt:items-center gpt:rounded-sm gpt:py-1.5 gpt:pl-8 gpt:pr-2 gpt:text-sm gpt:outline-none gpt:transition-colors gpt:focus:bg-accent gpt:focus:text-accent-foreground gpt:data-[disabled]:pointer-events-none gpt:data-[disabled]:opacity-50",
      className
    )}
    checked={checked}
    {...props}
  >
    <span className="gpt:absolute gpt:left-2 gpt:flex gpt:h-3.5 gpt:w-3.5 gpt:items-center gpt:justify-center">
      <DropdownMenuPrimitive.ItemIndicator>
        <Check className="gpt:h-4 gpt:w-4" />
      </DropdownMenuPrimitive.ItemIndicator>
    </span>
    {children}
  </DropdownMenuPrimitive.CheckboxItem>
))
DropdownMenuCheckboxItem.displayName =
  DropdownMenuPrimitive.CheckboxItem.displayName

const DropdownMenuRadioItem = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.RadioItem>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.RadioItem>
>(({ className, children, ...props }, ref) => (
  <DropdownMenuPrimitive.RadioItem
    ref={ref}
    className={cn(
      "gpt:relative gpt:flex gpt:cursor-default gpt:select-none gpt:items-center gpt:rounded-sm gpt:py-1.5 gpt:pl-8 gpt:pr-2 gpt:text-sm gpt:outline-none gpt:transition-colors gpt:focus:bg-accent gpt:focus:text-accent-foreground gpt:data-[disabled]:pointer-events-none gpt:data-[disabled]:opacity-50",
      className
    )}
    {...props}
  >
    <span className="gpt:absolute gpt:left-2 gpt:flex gpt:h-3.5 gpt:w-3.5 gpt:items-center gpt:justify-center">
      <DropdownMenuPrimitive.ItemIndicator>
        <Circle className="gpt:h-2 gpt:w-2 gpt:fill-current" />
      </DropdownMenuPrimitive.ItemIndicator>
    </span>
    {children}
  </DropdownMenuPrimitive.RadioItem>
))
DropdownMenuRadioItem.displayName = DropdownMenuPrimitive.RadioItem.displayName

const DropdownMenuLabel = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Label>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Label> & {
    inset?: boolean
  }
>(({ className, inset, ...props }, ref) => (
  <DropdownMenuPrimitive.Label
    ref={ref}
    className={cn(
      "gpt:px-2 gpt:py-1.5 gpt:text-sm gpt:font-semibold",
      inset && "gpt:pl-8",
      className
    )}
    {...props}
  />
))
DropdownMenuLabel.displayName = DropdownMenuPrimitive.Label.displayName

const DropdownMenuSeparator = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Separator>
>(({ className, ...props }, ref) => (
  <DropdownMenuPrimitive.Separator
    ref={ref}
    className={cn("gpt:-mx-1 gpt:my-1 gpt:h-px gpt:bg-muted", className)}
    {...props}
  />
))
DropdownMenuSeparator.displayName = DropdownMenuPrimitive.Separator.displayName

const DropdownMenuShortcut = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement>) => {
  return (
    <span
      className={cn("gpt:ml-auto gpt:text-xs gpt:tracking-widest gpt:opacity-60", className)}
      {...props}
    />
  )
}
DropdownMenuShortcut.displayName = "DropdownMenuShortcut"

export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuGroup,
  DropdownMenuPortal,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuRadioGroup,
}
