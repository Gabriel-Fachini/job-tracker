import { AppSidebar } from "@/components/app-sidebar";
import { MonitoringProgressProvider } from "@/components/leads/monitoring-progress-context";
import { MobileNav } from "@/components/mobile-nav";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

export default function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <MonitoringProgressProvider>
      <SidebarProvider defaultOpen>
        <AppSidebar />
        <SidebarInset>
          {/* Phones reserve room for the fixed tab bar and the home indicator. */}
          <div className="flex flex-1 flex-col overflow-x-clip px-4 pt-5 pb-[calc(var(--mobile-nav-height)+env(safe-area-inset-bottom)+2rem)] sm:px-6 sm:pt-6 md:p-8 lg:p-14 xl:p-16 2xl:p-20">
            {children}
          </div>
        </SidebarInset>
        <MobileNav />
      </SidebarProvider>
    </MonitoringProgressProvider>
  );
}
