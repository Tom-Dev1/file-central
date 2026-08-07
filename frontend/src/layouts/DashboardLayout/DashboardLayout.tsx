import { useState } from "react";
import { Drawer, Layout, Typography } from "antd";
import { Cloud } from "lucide-react";
import { Outlet } from "react-router-dom";

import { DriveSelectionProvider } from "@/components/drive/selection/DriveSelectionContext";
import { DriveNProgress } from "@/components/DriveNProgress";
import { useTheme } from "@/contexts/themeContext";
import DashboardHeader from "./DashboardHeader";
import DashboardSidebar from "./DashboardSidebar";

const { Content, Sider } = Layout;

export default function DashboardLayout() {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const { resolvedTheme } = useTheme();

  return (
    <Layout className="h-dvh overflow-hidden !bg-background">
      <DriveNProgress />
      <DashboardHeader onOpenNavigation={() => setMobileSidebarOpen(true)} />

      <Layout className="min-h-0 flex-1 !bg-background">
        <Sider
          width={256}
          theme={resolvedTheme}
          className="!hidden overflow-y-auto border-r border-border/70 !bg-background lg:!block"
        >
          <DashboardSidebar />
        </Sider>

        <Content className="min-w-0 overflow-hidden !bg-background">
          <main className="mx-auto h-full min-w-0 max-w-[1600px] overflow-hidden">
            <DriveSelectionProvider>
              <Outlet />
            </DriveSelectionProvider>
          </main>
        </Content>
      </Layout>

      <Drawer
        placement="left"
        open={mobileSidebarOpen}
        onClose={() => setMobileSidebarOpen(false)}
        width="min(304px, calc(100vw - 32px))"
        styles={{ body: { padding: 0 } }}
        title={
          <div className="flex items-center gap-2.5">
            <span className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Cloud className="size-5" />
            </span>
            <Typography.Title level={4} className="!mb-0 !font-medium">
              File <span className="text-muted-foreground">Central</span>
            </Typography.Title>
          </div>
        }
      >
        <DashboardSidebar onNavigate={() => setMobileSidebarOpen(false)} />
      </Drawer>
    </Layout>
  );
}
