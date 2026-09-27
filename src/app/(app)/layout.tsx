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
          <div className="mx-auto flex w-full max-w-[76rem] flex-1 flex-col overflow-x-clip px-4 pt-5 pb-[calc(var(--mobile-nav-height)+env(safe-area-inset-bottom)+2rem)] sm:px-6 sm:pt-6 md:px-8 md:pt-7 md:pb-12 lg:px-10 lg:pt-8">
            {children}
          </div>
        </SidebarInset>
        <MobileNav />
      </SidebarProvider>
    </MonitoringProgressProvider>
  );
}
