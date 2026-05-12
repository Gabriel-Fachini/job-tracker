import { AppSidebar, MobileAppHeader } from "@/components/app-sidebar";
import { MonitoringProgressProvider } from "@/components/leads/monitoring-progress-context";
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
          <MobileAppHeader />
          <div className="flex flex-1 flex-col overflow-x-hidden px-4 pb-6 pt-4 sm:px-6 sm:pb-8 sm:pt-5 md:p-8 lg:p-14 xl:p-16 2xl:p-20">
            {children}
          </div>
        </SidebarInset>
      </SidebarProvider>
    </MonitoringProgressProvider>
  );
}
