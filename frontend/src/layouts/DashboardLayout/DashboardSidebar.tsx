import { Button, Divider, Menu, Progress, Tooltip, Typography, type MenuProps } from "antd";
import { Clock3, FileClock, HardDrive, Settings, Share2, Star, Trash2 } from "lucide-react";
import type { ComponentType } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import DropdownUpload from "@/components/PopoverUpload";

interface NavigationItem {
  title: string;
  path: string;
  icon: ComponentType<{ className?: string }>;
  available: boolean;
}

const navigationItems: NavigationItem[] = [
  { title: "My Drive", path: "/dashboard", icon: HardDrive, available: true },
  { title: "Shared with me", path: "/dashboard/shared", icon: Share2, available: true },
  { title: "Recent", path: "/dashboard/recent", icon: Clock3, available: false },
  { title: "Starred", path: "/dashboard/starred", icon: Star, available: false },
  { title: "Trash", path: "/dashboard/trash", icon: Trash2, available: true },
  { title: "Settings", path: "/dashboard/settings", icon: Settings, available: false },
];

interface DashboardSidebarProps {
  onNavigate?: () => void;
}

export default function DashboardSidebar({ onNavigate }: DashboardSidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const selectedKey = location.pathname === "/dashboard" || location.pathname.startsWith("/dashboard/folders/")
    ? "/dashboard"
    : location.pathname.startsWith("/dashboard/shared/folders/")
      ? "/dashboard/shared"
      : location.pathname;

  const menuItems: MenuProps["items"] = navigationItems.map((item) => {
    const Icon = item.icon;

    return {
      key: item.path,
      icon: <Icon className="size-[18px]" />,
      disabled: !item.available,
      label: (
        <span className="flex min-w-0 items-center justify-between gap-2">
          <span className="truncate">{item.title}</span>
          {!item.available && <span className="text-[10px] font-medium uppercase tracking-wide">Soon</span>}
        </span>
      ),
    };
  });

  const handleMenuClick: MenuProps["onClick"] = ({ key }) => {
    navigate(key);
    onNavigate?.();
  };

  return (
    <div className="flex h-full min-h-full flex-col bg-background">
      <div className="p-4">
        <DropdownUpload />
      </div>

      <nav aria-label="Dashboard navigation">
        <Menu
          mode="inline"
          selectedKeys={[selectedKey]}
          items={menuItems}
          onClick={handleMenuClick}
          className="!border-e-0 !bg-transparent px-3 [&_.ant-menu-item]:!mx-0 [&_.ant-menu-item]:!mb-1 [&_.ant-menu-item]:!w-full [&_.ant-menu-item]:!rounded-full"
        />
      </nav>

      <Divider className="!my-4" />

      <section className="px-6" aria-labelledby="storage-heading">
        <div className="flex items-center gap-3">
          <HardDrive className="size-5 text-muted-foreground" />
          <Typography.Text id="storage-heading" strong>
            Storage
          </Typography.Text>
        </div>

        <Progress percent={37} showInfo={false} size="small" className="!mb-0 !mt-3" />
        <Typography.Text type="secondary" className="!text-xs">
          5.6 GB of 15 GB used
        </Typography.Text>

        <Tooltip title="Storage upgrades are not available yet">
          <span
            role="note"
            tabIndex={0}
            aria-label="Get more storage. Storage upgrades are not available yet."
            className="mt-4 block rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          >
            <Button type="default" size="small" block disabled>
              Get more storage
            </Button>
          </span>
        </Tooltip>
      </section>

      <div className="mt-auto p-4">
        <div className="rounded-xl bg-muted/60 p-4">
          <div className="flex items-center gap-2">
            <FileClock className="size-4 text-muted-foreground" />
            <Typography.Text strong className="!text-sm">
              Activity
            </Typography.Text>
          </div>
          <Typography.Paragraph type="secondary" className="!mb-0 !mt-2 !text-xs !leading-5">
            Your recent file activity will appear here.
          </Typography.Paragraph>
        </div>
      </div>
    </div>
  );
}
