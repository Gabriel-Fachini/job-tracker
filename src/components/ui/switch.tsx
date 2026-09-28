"use client"

import { Switch as SwitchPrimitive } from "@base-ui/react/switch"
import { animated, config, useSpring } from "@react-spring/web"

import { cn } from "@/lib/utils"

const AnimatedThumb = animated(SwitchPrimitive.Thumb)

function Switch({ className, checked, ...props }: SwitchPrimitive.Root.Props) {
  // A bouncy spring instead of a linear slide: a small tactile "snap" that
  // reads as a real switch flipping rather than a CSS fade.
  const thumbStyle = useSpring({
    x: checked ? 13 : 2,
    config: config.wobbly,
  })

  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      checked={checked}
      className={cn(
        "peer inline-flex h-5 w-8 shrink-0 items-center rounded-full border border-transparent bg-input transition-colors duration-150 outline-none focus-visible:ring-3 focus-visible:ring-ring/40 disabled:pointer-events-none disabled:opacity-40 data-[checked]:bg-primary",
        className
      )}
      {...props}
    >
      <AnimatedThumb
        data-slot="switch-thumb"
        className="pointer-events-none block size-3.5 rounded-full bg-background shadow-sm"
        style={{ transform: thumbStyle.x.to((x) => `translateX(${x}px)`) }}
      />
    </SwitchPrimitive.Root>
  )
}

export { Switch }
