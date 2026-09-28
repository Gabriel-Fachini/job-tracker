"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { animated } from "@react-spring/web";

import { useMonitoringProgress } from "@/components/leads/monitoring-progress-context";
import { useNavIndicator } from "@/hooks/use-nav-indicator";
import { appNavigation } from "@/lib/navigation";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { StatusDot } from "@/components/ui/status";
import { ThemeCycleButton, ThemeToggle } from "@/components/theme-toggle";

export function AppSidebar() {
  const pathname = usePathname();
  const { isMobile, setOpenMobile } = useSidebar();
  const monitoring = useMonitoringProgress();

  const activeItem =
    appNavigation.find((item) => pathname === item.href) ??
    appNavigation.find((item) => pathname.startsWith(`${item.href}/`));
  const { containerRef, registerItem, style: indicatorStyle } = useNavIndicator(
    activeItem?.href ?? "",
  );

  function handleNavigationClick() {
    if (isMobile) {
      setOpenMobile(false);
    }
  }

  return (
    <Sidebar collapsible="icon" variant="sidebar">
      <SidebarHeader className="px-3 pt-3.5 pb-4">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              render={<Link href="/dashboard" />}
              tooltip="Job Tracker"
              onClick={handleNavigationClick}
              className="gap-2.5 hover:bg-transparent active:bg-transparent group-data-[collapsible=icon]:p-1.5!"
            >
              {/* Monogram drawn through a mask so it takes the theme's foreground. */}
              <span
                aria-hidden
                className="size-5 shrink-0 bg-foreground [mask:url(/brand/jt-mark.png)_center/contain_no-repeat]"
              />
              <span className="font-data text-[13px] font-medium text-foreground group-data-[collapsible=icon]:hidden">
                job-tracker
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup className="px-3 py-2">
          <SidebarGroupContent>
            <div ref={containerRef} className="relative">
              {/* Shared pill: slides and resizes to the active item instead
                  of the highlight popping straight from one item to the next. */}
              <animated.div
                aria-hidden
                className="pointer-events-none absolute left-0 rounded-md bg-sidebar-accent"
                style={{
                  opacity: indicatorStyle.opacity,
                  width: indicatorStyle.width.to((w) => `${w}px`),
                  height: indicatorStyle.height.to((h) => `${h}px`),
                  transform: indicatorStyle.y.to((y) => `translateY(${y}px)`),
                }}
              />

              <SidebarMenu className="gap-1">
                {appNavigation.map((item) => {
                  const Icon = item.icon;
                  const isActive = item.href === activeItem?.href;

                  return (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton
                        ref={registerItem(item.href)}
                        isActive={isActive}
                        size="lg"
                        render={<Link href={item.href} />}
                        tooltip={item.label}
                        onClick={handleNavigationClick}
                        className="group/nav relative gap-3 px-3 data-active:bg-transparent"
                      >
                        <Icon
                          aria-hidden
                          strokeWidth={1.75}
                          className="text-subtle-foreground transition-colors duration-150 group-hover/nav:text-foreground group-data-active/nav:text-foreground"
                        />
                        <span className="group-data-[collapsible=icon]:hidden">{item.label}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </div>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="gap-2 px-3 pb-3.5">
        {monitoring?.isRunning ? (
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                render={<Link href="/leads" />}
                tooltip="Radar em execução"
                onClick={handleNavigationClick}
                className="h-auto min-h-8 py-1.5 text-xs"
              >
                <span className="flex size-4 shrink-0 items-center justify-center">
                  <StatusDot tone="active" pulse />
                </span>
                <span className="flex min-w-0 flex-1 items-center gap-2 group-data-[collapsible=icon]:hidden">
                  <span className="min-w-0 flex-1 truncate">
                    {monitoring.currentCompany ?? "Radar iniciando"}
                  </span>
                  {monitoring.linksTotal > 0 ? (
                    <span className="shrink-0 font-data text-subtle-foreground">
                      {monitoring.linksProcessed}/{monitoring.linksTotal}
                    </span>
                  ) : null}
                </span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        ) : null}

        <div className="flex items-center justify-between gap-2 group-data-[collapsible=icon]:flex-col group-data-[collapsible=icon]:justify-center">
          <ThemeToggle className="group-data-[collapsible=icon]:hidden" />
          <ThemeCycleButton className="hidden group-data-[collapsible=icon]:inline-flex" />
          <SidebarTrigger
            aria-label="Recolher ou expandir menu (⌘B)"
            className="text-subtle-foreground hover:text-foreground"
          />
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
