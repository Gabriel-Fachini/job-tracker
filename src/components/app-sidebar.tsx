"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { PanelLeftIcon } from "lucide-react";


import { appNavigation } from "@/lib/navigation";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";

export function AppSidebar() {
  const pathname = usePathname();
  const { isMobile, setOpenMobile } = useSidebar();

  function handleNavigationClick() {
    if (isMobile) {
      setOpenMobile(false);
    }
  }

  return (
    <Sidebar collapsible="icon" variant="inset">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              isActive={pathname === "/dashboard"}
              render={<Link href="/dashboard" />}
              size="lg"
              tooltip="Ir para o dashboard"
            >
              <Image
                src="/job-tracker-logo.png"
                alt="Job Tracker"
                width={28}
                height={28}
                className="size-7 shrink-0"
                sizes="28px"
              />
              <span className="truncate font-heading font-semibold group-data-[collapsible=icon]:hidden">
                Job Tracker
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarSeparator />

      <SidebarContent>
        <SidebarGroup className="gap-2">
          <SidebarGroupLabel className="px-3 text-sm font-semibold tracking-[0.16em] text-sidebar-foreground/75">
            Módulos do MVP
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {appNavigation.map((item) => {
                const Icon = item.icon;
                const isActive =
                  pathname === item.href || pathname.startsWith(`${item.href}/`);

                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      isActive={isActive}
                      render={<Link href={item.href} />}
                      size="lg"
                      tooltip={item.summary}
                      onClick={handleNavigationClick}
                    >
                      <Icon />
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

      <SidebarFooter>
        <SidebarTrigger className="self-start" />
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
