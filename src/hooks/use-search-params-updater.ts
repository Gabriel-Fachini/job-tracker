"use client";

import { useCallback } from "react";
import { usePathname, useSearchParams } from "next/navigation";

/**
 * Updates search params through the History API. Next keeps `useSearchParams`
 * in sync without a server round trip, so filters and detail sheets open
 * instantly. Use `push` when Back should undo the change (opening a detail),
 * `replace` for continuous input (typing in a search box).
 */
export function useSearchParamsUpdater() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  return useCallback(
    (
      mutate: (params: URLSearchParams) => void,
      mode: "push" | "replace" = "push",
    ) => {
      const params = new URLSearchParams(searchParams.toString());
      mutate(params);

      const query = params.toString();
      const url = query ? `${pathname}?${query}` : pathname;

      if (mode === "replace") {
        window.history.replaceState(null, "", url);
      } else {
        window.history.pushState(null, "", url);
      }
    },
    [pathname, searchParams],
  );
}
