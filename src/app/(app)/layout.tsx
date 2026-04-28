import { AppSidebar } from "@/components/app-sidebar";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";

export default function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <SidebarProvider defaultOpen>
      <AppSidebar />
      <SidebarInset>
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 rounded-t-[inherit] border-b border-border/80 bg-background/95 px-4 backdrop-blur sm:px-6">
          <SidebarTrigger />
          <div className="flex min-w-0 flex-col">
            <p className="text-sm font-medium text-foreground">Job Tracker</p>
            <p className="truncate text-xs text-muted-foreground">
              Shell inicial do app local para perfil, vagas e candidaturas
            </p>
          </div>
        </header>
        <div className="flex flex-1 flex-col p-4 sm:p-6">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
