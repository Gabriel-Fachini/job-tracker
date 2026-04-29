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
        <header className="sticky top-0 z-20 flex h-18 items-center gap-3 rounded-t-[inherit] border-b border-border/80 bg-background/95 px-8 backdrop-blur sm:px-10 lg:px-14 xl:px-16">
          <SidebarTrigger />
          <div className="flex min-w-0 flex-col">
            <p className="text-base font-medium text-foreground">Job Tracker</p>
            <p className="truncate text-sm text-muted-foreground">
              Shell inicial do app local para perfil, vagas e candidaturas
            </p>
          </div>
        </header>
        <div className="flex flex-1 flex-col p-8 sm:p-10 lg:p-14 xl:p-16 2xl:p-20">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
