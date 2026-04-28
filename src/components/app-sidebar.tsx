"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Database, FolderOpenDot } from "lucide-react";

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
} from "@/components/ui/sidebar";

export function AppSidebar() {
  const pathname = usePathname();

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
            Modulos do MVP
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
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              tooltip="Base local com SQLite + Drizzle"
            >
              <Database />
              <span className="truncate group-data-[collapsible=icon]:hidden">
                SQLite local
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              tooltip="Uploads e PDFs ficam na pasta local do projeto"
            >
              <FolderOpenDot />
              <span className="truncate group-data-[collapsible=icon]:hidden">
                Arquivos em uploads/
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
