"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Briefcase, PanelLeftIcon } from "lucide-react";

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
  SidebarSeparator,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function AppSidebar() {
  const pathname = usePathname();
  const { isMobile, setOpenMobile, state } = useSidebar();

  function handleNavigationClick() {
    if (isMobile) {
      setOpenMobile(false);
    }
  }

  return (
    <Sidebar collapsible="icon" variant="inset">
      {/* ── Header / Logo ── */}
      <SidebarHeader className="pb-0">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              isActive={pathname === "/dashboard"}
              render={<Link href="/dashboard" />}
              size="lg"
              tooltip="Ir para o dashboard"
              className="group/logo h-12 gap-3 rounded-xl px-3 transition-all duration-200 hover:bg-sidebar-accent/60 data-[active=true]:bg-sidebar-accent/40"
            >
              <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary/20">
                <Briefcase className="size-4 text-sidebar-primary" />
              </div>
              <div className="flex min-w-0 flex-col group-data-[collapsible=icon]:hidden">
                <span className="truncate font-heading text-sm font-semibold leading-tight tracking-tight text-sidebar-foreground">
                  Job Tracker
                </span>
                <span className="truncate text-[10px] font-medium uppercase tracking-[0.14em] text-sidebar-foreground/40">
                  Rastreador de vagas
                </span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarSeparator className="mx-3 my-3 bg-sidebar-border/60" />

      {/* ── Navigation ── */}
      <SidebarContent>
        <SidebarGroup className="gap-1 px-2">
          <SidebarGroupContent>
            <SidebarMenu className="gap-0.5">
              {appNavigation.map((item) => {
                const Icon = item.icon;
                const isActive =
                  pathname === item.href ||
                  pathname.startsWith(`${item.href}/`);

                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      isActive={isActive}
                      render={<Link href={item.href} />}
                      size="lg"
                      tooltip={item.summary}
                      onClick={handleNavigationClick}
                      className={cn(
                        "group/nav relative h-10 gap-3 rounded-xl px-3 text-sm font-medium transition-all duration-150",
                        "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
                        isActive &&
                          "bg-sidebar-accent text-sidebar-foreground hover:bg-sidebar-accent"
                      )}
                    >
                      <Icon
                        className={cn(
                          "size-4 shrink-0 transition-colors",
                          isActive
                            ? "text-sidebar-foreground"
                            : "text-sidebar-foreground/50 group-hover/nav:text-sidebar-foreground/80"
                        )}
                      />
                      <span className="truncate group-data-[collapsible=icon]:hidden">
                        {item.label}
                      </span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {/* ── Footer / Collapse trigger ── */}
      <SidebarFooter className="px-3 pb-3">
        <SidebarSeparator className="mb-3 bg-sidebar-border/60" />
        <div className="flex justify-end group-data-[collapsible=icon]:justify-center">
          <SidebarTrigger className="h-9 rounded-xl px-3 text-sidebar-foreground/40 transition-all hover:bg-sidebar-accent/50 hover:text-sidebar-foreground/80" />
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}

export function MobileAppHeader() {
  const { setOpenMobile } = useSidebar();

  return (
    <div className="sticky top-0 z-30 border-b border-border/50 bg-background/90 px-4 pt-[calc(env(safe-area-inset-top)+0.75rem)] pb-3 backdrop-blur md:hidden">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Button
            type="button"
            aria-label="Abrir menu"
            className="size-10 rounded-xl border border-border/60 bg-card/70"
            onClick={() => setOpenMobile(true)}
            variant="ghost"
            size="icon-sm"
          >
            <PanelLeftIcon />
          </Button>
          <div className="min-w-0">
            <p className="truncate font-heading text-base font-semibold text-foreground">
              Job Tracker
            </p>
            <p className="truncate text-xs uppercase tracking-[0.16em] text-muted-foreground/70">
              Navegação principal
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
