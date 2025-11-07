import * as React from "react"
import * as AccordionPrimitive from "@radix-ui/react-accordion"
import { ChevronDownIcon } from "lucide-react"

import { cn } from "@/lib/utils"

function Accordion({
  ...props
}: React.ComponentProps<typeof AccordionPrimitive.Root>) {
  return <AccordionPrimitive.Root data-slot="accordion" {...props} />
}

function AccordionItem({
  className,
  ...props
}: React.ComponentProps<typeof AccordionPrimitive.Item>) {
  return (
    <AccordionPrimitive.Item
      data-slot="accordion-item"
      className={cn(className)}
      {...props}
    />
  )
}

function AccordionTrigger({
  className,
  children,
  ...props
}: React.ComponentProps<typeof AccordionPrimitive.Trigger>) {
  return (
    <AccordionPrimitive.Header className="gpt:flex">
      <AccordionPrimitive.Trigger
        data-slot="accordion-trigger"
        className={cn(
          "gpt:focus-visible:gpt:border-ring gpt:focus-visible:gpt:ring-ring/50 gpt:flex gpt:flex-1 gpt:items-start gpt:justify-between gpt:gap-4 gpt:rounded-md gpt:py-4 gpt:text-left gpt:text-sm gpt:font-medium gpt:transition-all gpt:outline-none gpt:hover:gpt:underline gpt:focus-visible:gpt:ring-[3px] gpt:disabled:pointer-events-none gpt:disabled:opacity-50 [&[data-state=open]>svg]:rotate-180",
          className
        )}
        {...props}
      >
        {children}
        <ChevronDownIcon id="test" className="gpt:dark:text-white gpt:text-black gpt:pointer-events-none gpt:size-4 gpt:shrink-0 gpt:translate-y-0.5 gpt:transition-transform gpt:duration-200" />
      </AccordionPrimitive.Trigger>
    </AccordionPrimitive.Header>
  )
}

function AccordionContent({
  className,
  children,
  ...props
}: React.ComponentProps<typeof AccordionPrimitive.Content>) {
  return (
    <AccordionPrimitive.Content
      data-slot="accordion-content"
      className="data-[state=closed]:gpt:animate-accordion-up data-[state=open]:gpt:animate-accordion-down gpt:overflow-hidden gpt:text-sm"
      {...props}
    >
      <div className={cn("gpt:pt-0 gpt:pb-4", className)}>{children}</div>
    </AccordionPrimitive.Content>
  )
}

export { Accordion, AccordionItem, AccordionTrigger, AccordionContent }
