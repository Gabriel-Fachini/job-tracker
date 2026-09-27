"use client"

import { Toaster as Sonner, type ToasterProps } from "sonner"
import { CircleCheckIcon, InfoIcon, TriangleAlertIcon, OctagonXIcon, Loader2Icon } from "lucide-react"

import { useIsMobile } from "@/hooks/use-mobile"
import { useResolvedTheme } from "@/hooks/use-theme"

const Toaster = ({ ...props }: ToasterProps) => {
  const isMobile = useIsMobile()
  const theme = useResolvedTheme()

  return (
    <Sonner
      theme={theme}
      // Bottom of the screen belongs to the tab bar and sheet actions on phones.
      position={isMobile ? "top-center" : "bottom-right"}
      mobileOffset={{ top: "calc(env(safe-area-inset-top) + 0.75rem)" }}
      className="toaster group"
      icons={{
        success: (
          <CircleCheckIcon className="size-4" />
        ),
        info: (
          <InfoIcon className="size-4" />
        ),
        warning: (
          <TriangleAlertIcon className="size-4" />
        ),
        error: (
          <OctagonXIcon className="size-4" />
        ),
        loading: (
          <Loader2Icon className="size-4 animate-spin" />
        ),
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius-xl)",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: "cn-toast",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
