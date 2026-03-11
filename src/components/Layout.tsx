import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Outlet } from "react-router-dom";
import { ThemeToggle } from "@/context/ThemeContext";

export function Layout() {
  return (
    <SidebarProvider style={{ "--sidebar-width": "220px" } as React.CSSProperties}>
      <div className="flex h-svh w-full overflow-hidden bg-background">
        <AppSidebar />
        <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
          <header className="shrink-0 h-14 flex items-center justify-between border-b border-border px-5 bg-card/60 backdrop-blur-md z-10">
            <SidebarTrigger className="text-muted-foreground hover:text-foreground transition-colors" />
            <ThemeToggle />
          </header>
          <main className="flex-1 overflow-y-auto overflow-x-hidden">
            <div className="p-6 lg:p-8 pb-16 w-full">
              <Outlet />
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}