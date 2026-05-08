import { AppSidebar } from "@/components/app-sidebar";
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
          <div className="flex flex-1 flex-col overflow-x-hidden p-8 sm:p-10 lg:p-14 xl:p-16 2xl:p-20">{children}</div>
        </SidebarInset>
      </SidebarProvider>
    </MonitoringProgressProvider>
  );
}
