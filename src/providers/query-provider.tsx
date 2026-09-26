"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { useState } from "react";

import { useIsMobile } from "@/hooks/use-mobile";

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { staleTime: 30_000 } },
      })
  );

  // The floating devtools button would sit on top of the phone tab bar.
  const isMobile = useIsMobile();

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {isMobile ? null : <ReactQueryDevtools initialIsOpen={false} />}
    </QueryClientProvider>
  );
}
