"use client"

import { Checkbox as CheckboxPrimitive } from "@base-ui/react/checkbox"
import { animated, config, useSpring } from "@react-spring/web"
import { CheckIcon, MinusIcon } from "lucide-react"

import { cn } from "@/lib/utils"

function Checkbox({
  className,
  checked,
  indeterminate,
  ...props
}: CheckboxPrimitive.Root.Props) {
  // Kept mounted so the tick can spring in and out instead of just appearing.
  const active = Boolean(checked) || Boolean(indeterminate)
  const tickStyle = useSpring({
    transform: active ? "scale(1)" : "scale(0)",
    config: config.stiff,
  })

  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      checked={checked}
      indeterminate={indeterminate}
      className={cn(
        "flex size-4 shrink-0 items-center justify-center rounded-[4px] border border-border-strong bg-field outline-none transition-colors duration-150 focus-visible:ring-3 focus-visible:ring-ring/40 disabled:pointer-events-none disabled:opacity-40 data-[checked]:border-primary data-[checked]:bg-primary data-[checked]:text-primary-foreground data-[indeterminate]:border-primary data-[indeterminate]:bg-primary data-[indeterminate]:text-primary-foreground",
        className
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator
        keepMounted
        data-slot="checkbox-indicator"
        className="group flex items-center justify-center text-current"
      >
        <animated.span style={tickStyle} className="flex items-center justify-center">
          <CheckIcon className="size-3 group-data-[indeterminate]:hidden" />
          <MinusIcon className="hidden size-3 group-data-[indeterminate]:block" />
        </animated.span>
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  )
}

export { Checkbox }
