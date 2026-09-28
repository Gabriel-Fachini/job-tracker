"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { animated } from "@react-spring/web";

import { useMonitoringProgress } from "@/components/leads/monitoring-progress-context";
import { useNavIndicator } from "@/hooks/use-nav-indicator";
import { appNavigation } from "@/lib/navigation";
import { cn } from "@/lib/utils";

/** Bottom tab bar for phones; the sidebar takes over from `md` up. */
export function MobileNav() {
  const pathname = usePathname();
  const monitoring = useMonitoringProgress();
  const isRadarRunning = monitoring?.isRunning ?? false;

  const activeItem =
    appNavigation.find((item) => pathname === item.href) ??
    appNavigation.find((item) => pathname.startsWith(`${item.href}/`));
  const { containerRef, registerItem, style: indicatorStyle } = useNavIndicator(
    activeItem?.href ?? "",
  );

  return (
    <nav
      aria-label="Navegação principal"
      data-slot="mobile-nav"
      className="fixed inset-x-0 bottom-0 z-(--z-nav) border-t border-border bg-background pb-[env(safe-area-inset-bottom)] transition-[translate] duration-200 ease-(--ease-out-quart) md:hidden"
    >
      <ul
        ref={containerRef}
        className="relative mx-auto grid h-(--mobile-nav-height) max-w-lg grid-cols-5"
      >
        {/* One shared hairline that slides under the active tab, instead of
            each tab drawing its own and popping between them. */}
        <animated.span
          aria-hidden
          className="pointer-events-none absolute top-[-1px] h-px bg-foreground"
          style={{
            opacity: indicatorStyle.opacity,
            width: indicatorStyle.width.to((w) => Math.max(w - 40, 0)),
            transform: indicatorStyle.x.to((x) => `translateX(${x + 20}px)`),
          }}
        />

        {appNavigation.map((item) => {
          const Icon = item.icon;
          const isActive = item.href === activeItem?.href;
          const showRadarSignal = item.href === "/leads" && isRadarRunning;

          return (
            <li
              key={item.href}
              ref={registerItem(item.href)}
              className="min-w-0"
            >
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
                <span className="relative flex size-7 items-center justify-center rounded-md group-focus-visible/tab:ring-2 group-focus-visible/tab:ring-ring">
                  <Icon
                    aria-hidden
                    className="size-5"
                    strokeWidth={isActive ? 2 : 1.75}
                  />
                  {showRadarSignal ? (
                    <span
                      aria-hidden
                      className="absolute top-0.5 right-0 size-1.5 rounded-full bg-info ring-2 ring-background motion-safe:animate-pulse"
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
