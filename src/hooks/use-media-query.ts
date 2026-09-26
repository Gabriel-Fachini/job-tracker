import * as React from "react"

/**
 * Subscribes to a CSS media query. Returns `false` during SSR and hydration,
 * then the live value, so markup rendered on the server always matches the
 * desktop branch.
 */
export function useMediaQuery(query: string) {
  const subscribe = React.useCallback(
    (callback: () => void) => {
      if (typeof window === "undefined") {
        return () => undefined
      }

      const mql = window.matchMedia(query)
      mql.addEventListener("change", callback)
      return () => mql.removeEventListener("change", callback)
    },
    [query]
  )

  const getSnapshot = React.useCallback(
    () => (typeof window === "undefined" ? false : window.matchMedia(query).matches),
    [query]
  )

  return React.useSyncExternalStore(subscribe, getSnapshot, () => false)
}

/** Phones in portrait: dialogs become swipeable bottom sheets below this width. */
export const PHONE_QUERY = "(max-width: 639px)"
