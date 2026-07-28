import { Outlet } from "react-router-dom";
import DashboardSidebar from "./DashboardSidebar";
import DashboardHeader from "./DashboardHeader";
import { DriveSelectionProvider } from "@/components/drive/selection/DriveSelectionContext";
import { DriveNProgress } from "@/components/DriveNProgress";

export default function DashboardLayout() {
  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-background">
      <DriveNProgress />
      <DashboardHeader />

      <div className="flex min-h-0 flex-1">
        <aside className="hidden w-64 shrink-0 overflow-y-auto border-r border-border/70 bg-background lg:block">
          <DashboardSidebar />
        </aside>

        <main className="min-w-0 flex-1 overflow-hidden mx-auto max-w-[1600px] space-y-6">
          <DriveSelectionProvider>
            <Outlet />
          </DriveSelectionProvider>
        </main>
      </div>
    </div>
  );
}
