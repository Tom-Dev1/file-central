import { Outlet } from "react-router-dom";
import DashboardSidebar from "./DashboardSidebar";
import DashboardHeader from "./DashboardHeader";

export default function DashboardLayout() {
  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-background">
      <DashboardHeader />

      <div className="flex min-h-0 flex-1">
        <aside className="hidden w-64 shrink-0 overflow-y-auto border-r border-border/70 bg-background lg:block">
          <DashboardSidebar />
        </aside>

        <main className="custom-scrollbar min-w-0 flex-1 overflow-y-auto overscroll-contain bg-background">
          <div className="p-4 sm:p-6">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
