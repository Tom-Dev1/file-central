import { Button, Divider, Menu, Progress, Tooltip, Typography, type MenuProps } from "antd";
import { Clock3, Cloud, HardDrive, Settings, Share2, Star, Trash2 } from "lucide-react";
import type { ComponentType } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import classes from "./DashboardSidebar.module.css";

interface NavigationItem {
  title: string;
  path: string;
  icon: ComponentType<{ className?: string }>;
  available: boolean;
}

const navigationItems: NavigationItem[] = [
  {
    title: "My Drive",
    path: "/dashboard",
    icon: HardDrive,
    available: true,
  },
  {
    title: "Shared with me",
    path: "/dashboard/shared",
    icon: Share2,
    available: true,
  },
  {
    title: "Recent",
    path: "/dashboard/recent",
    icon: Clock3,
    available: true,
  },
  {
    title: "Starred",
    path: "/dashboard/starred",
    icon: Star,
    available: true,
  },
  {
    title: "Trash",
    path: "/dashboard/trash",
    icon: Trash2,
    available: true,
  },
  {
    title: "Settings",
    path: "/dashboard/settings",
    icon: Settings,
    available: false,
  },
];

interface DashboardSidebarProps {
  collapsed?: boolean;
  onNavigate?: () => void;
}

export default function DashboardSidebar({ collapsed = false, onNavigate }: DashboardSidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();

  const selectedKey =
    location.pathname === "/dashboard" || location.pathname.startsWith("/dashboard/folders/")
      ? "/dashboard"
      : location.pathname.startsWith("/dashboard/shared/folders/")
      ? "/dashboard/shared"
      : location.pathname;

  const menuItems: MenuProps["items"] = navigationItems.map((item) => {
    const Icon = item.icon;

    return {
      key: item.path,
      icon: <Icon className={classes.icon} />,
      disabled: !item.available,
      label: (
        <span className={classes.menuLabel}>
          <span className={classes.menuTitle}>{item.title}</span>

          {!item.available && <span className={classes.soonLabel}>Soon</span>}
        </span>
      ),
    };
  });

  const handleMenuClick: MenuProps["onClick"] = ({ key }) => {
    navigate(key);
    onNavigate?.();
  };

  return (
    <div className={classes.sidebar} data-collapsed={collapsed || undefined}>
      <div className={classes.brand}>
        <div className={classes.brandMark}>
          <Cloud className={classes.brandIcon} />
        </div>

        {!collapsed && (
          <div className={classes.brandText}>
            <span className={classes.brandName}>File</span>

            <span className={classes.brandAccent}>Central</span>
          </div>
        )}
      </div>

      {/* <Tooltip title={collapsed ? "Create or upload" : undefined} placement="right">
        <div className={classes.createArea}>
          <DropdownUpload />
        </div>
      </Tooltip> */}

      <nav className={classes.navigation}>
        <Menu
          mode="inline"
          inlineCollapsed={collapsed}
          selectedKeys={[selectedKey]}
          items={menuItems}
          onClick={handleMenuClick}
          className={classes.menu}
        />
      </nav>

      {!collapsed && (
        <>
          <Divider className={classes.divider} />

          <section className={classes.storageSection} aria-labelledby="storage-heading">
            <div className={classes.sectionHeading}>
              <HardDrive className={classes.sectionIcon} />

              <Typography.Text id="storage-heading" strong>
                Storage
              </Typography.Text>
            </div>

            <Progress percent={37} showInfo={false} size="small" className={classes.progress} />

            <Typography.Text type="secondary" className={classes.storageText}>
              5.6 GB of 15 GB used
            </Typography.Text>

            <Tooltip title="Storage upgrades are not available yet">
              <span
                role="note"
                tabIndex={0}
                aria-label="Get more storage. Storage upgrades are not available yet."
                className={classes.storageUpgrade}
              >
                <Button type="default" size="small" block disabled>
                  Get more storage
                </Button>
              </span>
            </Tooltip>
          </section>
        </>
      )}
    </div>
  );
}
