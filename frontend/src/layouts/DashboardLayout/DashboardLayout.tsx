import { useState } from "react";
import { Drawer, Layout, Typography } from "antd";
import { Cloud } from "lucide-react";
import { Outlet } from "react-router-dom";

import { DriveSelectionProvider } from "@/components/drive/selection/DriveSelectionContext";
import { DriveNProgress } from "@/components/DriveNProgress";
import { useTheme } from "@/contexts/themeContext";
import DashboardHeader from "./DashboardHeader";
import DashboardSidebar from "./DashboardSidebar";
import styles from "./DashboardLayout.module.css";

const { Content, Sider } = Layout;
const DASHBOARD_SIDEBAR_ID = "dashboard-primary-navigation";
const SIDEBAR_PREFERENCE_KEY = "file-central-dashboard-sidebar-collapsed";

function getInitialSidebarState() {
  if (typeof window === "undefined") {
    return false;
  }

  try {
    return window.localStorage.getItem(SIDEBAR_PREFERENCE_KEY) === "true";
  } catch {
    return false;
  }
}

export default function DashboardLayout() {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(getInitialSidebarState);
  const { resolvedTheme } = useTheme();

  const toggleSidebar = () => {
    const nextCollapsed = !sidebarCollapsed;
    setSidebarCollapsed(nextCollapsed);

    try {
      window.localStorage.setItem(SIDEBAR_PREFERENCE_KEY, String(nextCollapsed));
    } catch {
      // Keep the in-memory preference when storage is unavailable.
    }
  };

  return (
    <Layout className={styles.root}>
      <DriveNProgress />
      <DashboardHeader
        onOpenMobileNavigation={() => setMobileSidebarOpen(true)}
        onToggleSidebar={toggleSidebar}
        sidebarCollapsed={sidebarCollapsed}
        sidebarId={DASHBOARD_SIDEBAR_ID}
      />

      <Layout className={styles.body} hasSider>
        <Sider
          id={DASHBOARD_SIDEBAR_ID}
          width={256}
          collapsedWidth={80}
          collapsible
          collapsed={sidebarCollapsed}
          onCollapse={setSidebarCollapsed}
          trigger={null}
          theme={resolvedTheme}
          className={styles.sider}
        >
          <DashboardSidebar collapsed={sidebarCollapsed} />
        </Sider>

        <Content className={styles.content}>
          <main className={styles.main}>
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
        size="min(304px, calc(100vw - 32px))"
        styles={{ body: { padding: 0 } }}
        title={
          <div className={styles.drawerTitle}>
            <span className={styles.brandMark}>
              <Cloud className={styles.brandIcon} />
            </span>
            <Typography.Title level={4} className={styles.brandTitle}>
              File <span className={styles.muted}>Central</span>
            </Typography.Title>
          </div>
        }
      >
        <DashboardSidebar collapsed={false} onNavigate={() => setMobileSidebarOpen(false)} />
      </Drawer>
    </Layout>
  );
}
