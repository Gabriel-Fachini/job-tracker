import { AppSidebar } from "@/components/app-sidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

export default function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <SidebarProvider defaultOpen>
      <AppSidebar />
      <SidebarInset>
        <div className="flex flex-1 flex-col p-8 sm:p-10 lg:p-14 xl:p-16 2xl:p-20">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
