"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { useMonitoringProgress } from "@/components/leads/monitoring-progress-context";
import { appNavigation } from "@/lib/navigation";
import { cn } from "@/lib/utils";

/** Bottom tab bar for phones; the sidebar takes over from `md` up. */
export function MobileNav() {
  const pathname = usePathname();
  const monitoring = useMonitoringProgress();
  const isRadarRunning = monitoring?.isRunning ?? false;

  return (
    <nav
      aria-label="Navegação principal"
      data-slot="mobile-nav"
      className="fixed inset-x-0 bottom-0 z-(--z-nav) border-t border-border bg-canvas pb-[env(safe-area-inset-bottom)] transition-[translate] duration-200 ease-(--ease-out-quart) md:hidden"
    >
      <ul className="mx-auto grid h-(--mobile-nav-height) max-w-lg grid-cols-5">
        {appNavigation.map((item) => {
          const Icon = item.icon;
          const isActive =
            pathname === item.href || pathname.startsWith(`${item.href}/`);
          const showRadarSignal = item.href === "/leads" && isRadarRunning;

          return (
            <li key={item.href} className="min-w-0">
              <Link
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "group/tab relative flex h-full flex-col items-center justify-center gap-1 px-0.5 text-[11px] leading-none font-medium outline-none transition-colors duration-150",
                  isActive
                    ? "text-foreground"
                    : "text-subtle-foreground active:text-foreground",
                )}
              >
                {/* Active tab: hairline on the bar's top edge. */}
                <span
                  aria-hidden
                  className={cn(
                    "absolute inset-x-5 top-[-1px] h-px transition-colors duration-150",
                    isActive ? "bg-foreground" : "bg-transparent",
                  )}
                />
                <span className="relative flex size-7 items-center justify-center rounded-md group-focus-visible/tab:ring-2 group-focus-visible/tab:ring-ring">
                  <Icon
                    aria-hidden
                    className="size-5"
                    strokeWidth={isActive ? 2 : 1.75}
                  />
                  {showRadarSignal ? (
                    <span
                      aria-hidden
                      className="absolute top-0.5 right-0 size-1.5 rounded-full bg-info ring-2 ring-canvas motion-safe:animate-pulse"
                    />
                  ) : null}
                </span>
                <span className="max-w-full truncate">{item.label}</span>
                {showRadarSignal ? (
                  <span className="sr-only">(radar em execução)</span>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
