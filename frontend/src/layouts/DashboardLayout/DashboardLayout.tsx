import { useState } from "react";
import { Layout } from "antd";
import { Outlet } from "react-router-dom";

import { DriveSelectionProvider } from "@/components/drive/selection/DriveSelectionContext";
import { DriveNProgress } from "@/components/DriveNProgress";
import { useTheme } from "@/contexts/themeContext";

import DashboardSidebar from "./DashboardSidebar";

import styles from "./DashboardLayout.module.css";
import DashboardHeader from "./DashboardHeader";

const { Content, Sider } = Layout;

const SIDEBAR_PREFERENCE_KEY = "file-central-dashboard-sidebar-collapsed";

function getInitialSidebarState(): boolean {
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
  const [sidebarCollapsed, setSidebarCollapsed] = useState(getInitialSidebarState);

  const { resolvedTheme } = useTheme();

  const updateSidebarCollapsed = (collapsed: boolean) => {
    setSidebarCollapsed(collapsed);

    try {
      window.localStorage.setItem(SIDEBAR_PREFERENCE_KEY, String(collapsed));
    } catch {
      // Keep the in-memory preference when storage is unavailable.
    }
  };

  const toggleSidebar = () => {
    updateSidebarCollapsed(!sidebarCollapsed);
  };

  return (
    <DriveSelectionProvider>
      <Layout className={styles.dashboardLayout} hasSider>
        <DriveNProgress />

        <Sider
          width={256}
          collapsedWidth={80}
          collapsible
          collapsed={sidebarCollapsed}
          onCollapse={updateSidebarCollapsed}
          trigger={null}
          theme={resolvedTheme}
          className={styles.sidebar}
        >
          <DashboardSidebar collapsed={sidebarCollapsed} />
        </Sider>

        <Layout className={styles.mainLayout}>
          <DashboardHeader sidebarCollapsed={sidebarCollapsed} onToggleSidebar={toggleSidebar} />
          <Content className={styles.content}>
            <main className={styles.main}>
              <Outlet />
            </main>
          </Content>
        </Layout>
      </Layout>
    </DriveSelectionProvider>
  );
}
