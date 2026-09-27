"use client"

import * as React from "react"
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog"
import { Drawer as DrawerPrimitive } from "@base-ui/react/drawer"
import { XIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { PHONE_QUERY, useMediaQuery } from "@/hooks/use-media-query"

/** True when the dialog tree is rendering as a phone bottom sheet. */
const DialogSheetContext = React.createContext(false)

function useIsDialogSheet() {
  return React.useContext(DialogSheetContext)
}

type DialogProps = {
  open?: boolean
  defaultOpen?: boolean
  onOpenChange?: (open: boolean) => void
  children?: React.ReactNode
}

/**
 * Centered dialog from `sm` up. On phones the same tree renders as a bottom
 * sheet that can be dragged down to dismiss. Title, description, close and
 * trigger parts are shared by both, so consumers don't branch.
 */
function Dialog({ onOpenChange, ...props }: DialogProps) {
  const isPhone = useMediaQuery(PHONE_QUERY)
  const handleOpenChange = onOpenChange
    ? (open: boolean) => onOpenChange(open)
    : undefined

  if (isPhone) {
    return (
      <DialogSheetContext.Provider value>
        <DrawerPrimitive.Root onOpenChange={handleOpenChange} {...props} />
      </DialogSheetContext.Provider>
    )
  }

  return <DialogPrimitive.Root onOpenChange={handleOpenChange} {...props} />
}

function DialogTrigger({ ...props }: DialogPrimitive.Trigger.Props) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />
}

function DialogPortal({ ...props }: DialogPrimitive.Portal.Props) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />
}

function DialogClose({ ...props }: DialogPrimitive.Close.Props) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />
}

function DialogOverlay({
  className,
  ...props
}: DialogPrimitive.Backdrop.Props) {
  return (
    <DialogPrimitive.Backdrop
      data-slot="dialog-overlay"
      className={cn(
        "fixed inset-0 isolate z-50 bg-overlay duration-150 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0",
        className
      )}
      {...props}
    />
  )
}

// `render` and state-function class names differ between the dialog and the
// drawer popups; consumers only pass plain strings.
type DialogContentProps = Omit<
  DialogPrimitive.Popup.Props,
  "render" | "className" | "style"
> & {
  className?: string
  style?: React.CSSProperties
  showCloseButton?: boolean
  /**
   * Phone sheet height. `full` pins long, scrolling content to the top of the
   * screen; `auto` hugs short content. No effect on the centered dialog.
   */
  sheetSize?: "auto" | "full"
}

function DialogContent({
  className,
  children,
  showCloseButton = true,
  sheetSize = "auto",
  initialFocus,
  ...props
}: DialogContentProps) {
  const isSheet = useIsDialogSheet()
  const popupRef = React.useRef<HTMLDivElement>(null)

  if (isSheet) {
    return (
      <DrawerPrimitive.Portal>
        <DrawerPrimitive.Backdrop
          data-slot="dialog-overlay"
          className="fixed inset-0 z-50 bg-overlay opacity-[calc(1_-_var(--drawer-swipe-progress,0))] transition-opacity duration-300 ease-(--ease-out-quart) data-starting-style:opacity-0 data-ending-style:opacity-0 data-swiping:duration-0"
        />
        <DrawerPrimitive.Viewport className="fixed inset-0 z-50 flex items-end justify-center">
          <DrawerPrimitive.Popup
            ref={popupRef}
            // Opening by touch focuses the sheet itself: focus stays inside for
            // screen readers, but no input grabs focus and pops the keyboard.
            initialFocus={
              initialFocus ??
              ((openType) => (openType === "touch" ? popupRef.current : true))
            }
            data-slot="dialog-content"
            className={cn(
              "relative flex max-h-[calc(100dvh-env(safe-area-inset-top)-0.75rem)] w-full flex-col gap-4 rounded-t-2xl border-t border-border bg-popover px-4 pt-6 pb-[max(1rem,env(safe-area-inset-bottom))] text-sm text-popover-foreground shadow-overlay outline-none touch-none",
              // Follows the finger while dragging, then eases home or away.
              "[transform:translateY(var(--drawer-swipe-movement-y,0))] transition-transform duration-[420ms] ease-(--ease-out-expo) will-change-transform",
              "data-starting-style:[transform:translateY(100%)] data-ending-style:[transform:translateY(100%)] data-ending-style:duration-[calc(var(--drawer-swipe-strength,1)*320ms)] data-swiping:select-none data-swiping:duration-0",
              // Paints below the sheet so an upward overscroll never reveals the page.
              "after:pointer-events-none after:absolute after:inset-x-0 after:top-full after:h-16 after:bg-popover",
              sheetSize === "full" &&
                "h-[calc(100dvh-env(safe-area-inset-top)-0.75rem)]",
              className
            )}
            {...props}
          >
            <div
              aria-hidden
              className="absolute top-2 left-1/2 h-1 w-9 -translate-x-1/2 rounded-full bg-border-strong"
            />
            {children}
            {showCloseButton && <DialogCloseButton className="top-3 right-3" />}
          </DrawerPrimitive.Popup>
        </DrawerPrimitive.Viewport>
      </DrawerPrimitive.Portal>
    )
  }

  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Popup
        initialFocus={initialFocus}
        data-slot="dialog-content"
        className={cn(
          "fixed top-1/2 left-1/2 z-50 grid max-h-[calc(100svh-2rem)] w-full max-w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 gap-4 overflow-hidden overscroll-contain rounded-xl border border-border bg-popover p-4 text-sm text-popover-foreground shadow-overlay duration-150 outline-none data-open:animate-in data-open:fade-in-0 data-open:zoom-in-[0.98] data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-[0.98]",
          className
        )}
        {...props}
      >
        {children}
        {showCloseButton && <DialogCloseButton className="top-3 right-3" />}
      </DialogPrimitive.Popup>
    </DialogPortal>
  )
}

function DialogCloseButton({ className }: { className?: string }) {
  return (
    <DialogPrimitive.Close
      data-slot="dialog-close"
      render={
        <Button
          variant="ghost"
          size="icon-sm"
          className={cn(
            "absolute z-10 text-muted-foreground hover:text-foreground",
            className
          )}
        />
      }
    >
      <XIcon />
      <span className="sr-only">Fechar</span>
    </DialogPrimitive.Close>
  )
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-header"
      className={cn("flex flex-col gap-2", className)}
      {...props}
    />
  )
}

function DialogFooter({
  className,
  showCloseButton = false,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  showCloseButton?: boolean
}) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        "-mx-4 -mb-4 flex flex-col-reverse gap-2 rounded-b-xl border-t border-border p-4 sm:flex-row sm:justify-end",
        className
      )}
      {...props}
    >
      {children}
      {showCloseButton && (
        <DialogPrimitive.Close render={<Button variant="outline" />}>
          Fechar
        </DialogPrimitive.Close>
      )}
    </div>
  )
}

function DialogTitle({ className, ...props }: DialogPrimitive.Title.Props) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn(
        "font-heading text-base leading-snug font-semibold tracking-tight",
        className
      )}
      {...props}
    />
  )
}

function DialogDescription({
  className,
  ...props
}: DialogPrimitive.Description.Props) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn(
        "text-sm text-muted-foreground *:[a]:underline *:[a]:underline-offset-3 *:[a]:hover:text-foreground",
        className
      )}
      {...props}
    />
  )
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
  useIsDialogSheet,
}
