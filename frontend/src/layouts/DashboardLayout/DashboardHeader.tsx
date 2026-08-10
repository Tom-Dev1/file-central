import { LoadingOutlined, MenuFoldOutlined, MenuUnfoldOutlined } from "@ant-design/icons";
import { App, Avatar, Button, Dropdown, Input, Layout, Tooltip, Typography, type MenuProps } from "antd";
import { Cloud, LogOut, Menu as MenuIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";

import { ModeToggle } from "@/components/theme/ModeToggle";
import { useLogout } from "@/hooks/useAuth";
import { authUserStorage, type StoredUser } from "@/lib/authUserStorage";
import classes from "./DashboardHeader.module.css";

interface DashboardHeaderProps {
  onOpenMobileNavigation: () => void;
  onToggleSidebar: () => void;
  sidebarCollapsed: boolean;
  sidebarId: string;
}

function DashboardHeader({
  onOpenMobileNavigation,
  onToggleSidebar,
  sidebarCollapsed,
  sidebarId,
}: DashboardHeaderProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const logout = useLogout();
  const { message } = App.useApp();
  const [currentUser, setCurrentUser] = useState<StoredUser | null>(() => authUserStorage.getUser());
  const urlSearchQuery = location.pathname === "/dashboard"
    ? new URLSearchParams(location.search).get("q") ?? ""
    : "";
  const [searchState, setSearchState] = useState(() => ({
    urlQuery: urlSearchQuery,
    value: urlSearchQuery,
  }));

  if (searchState.urlQuery !== urlSearchQuery) {
    setSearchState({ urlQuery: urlSearchQuery, value: urlSearchQuery });
  }

  const displayName = currentUser?.name || currentUser?.username || currentUser?.email || "User";
  const initials = getInitials(displayName);

  useEffect(() => {
    const synchronizeUser = () => {
      setCurrentUser(authUserStorage.getUser());
    };

    window.addEventListener("storage", synchronizeUser);

    return () => {
      window.removeEventListener("storage", synchronizeUser);
    };
  }, []);

  const handleSearch = (value: string) => {
    const query = value.trim();
    const searchParams = new URLSearchParams();

    if (query) {
      searchParams.set("q", query);
    }

    const target = query ? `/dashboard?${searchParams.toString()}` : "/dashboard";
    const currentTarget = `${location.pathname}${location.search}`;

    setSearchState({ urlQuery: urlSearchQuery, value: query });

    if (target !== currentTarget) {
      navigate(target);
    }
  };

  const handleLogout = async () => {
    try {
      await logout.mutateAsync();
      setCurrentUser(null);
      navigate("/auth/login", { replace: true });
    } catch {
      void message.error("Unable to sign out. Please try again.");
    }
  };

  const accountItems: MenuProps["items"] = [
    {
      key: "identity",
      disabled: true,
      label: (
        <div className={classes.accountIdentity}>
          <Typography.Text strong className={classes.truncatedText}>
            {displayName}
          </Typography.Text>
          {currentUser?.email && (
            <Typography.Text type="secondary" className={classes.accountEmail}>
              {currentUser.email}
            </Typography.Text>
          )}
        </div>
      ),
    },
    { type: "divider" },
    {
      key: "logout",
      danger: true,
      disabled: logout.isPending,
      icon: logout.isPending ? <LoadingOutlined spin /> : <LogOut className={classes.icon} />,
      label: logout.isPending ? "Signing out…" : "Sign out",
      onClick: () => void handleLogout(),
    },
  ];

  const sidebarToggleLabel = sidebarCollapsed ? "Expand navigation" : "Collapse navigation";

  return (
    <Layout.Header className={classes.header}>
      <div className={classes.row}>
        <Tooltip title="Open navigation">
          <Button
            type="text"
            shape="circle"
            size="large"
            className={classes.mobileNavigationButton}
            aria-label="Open navigation menu"
            icon={<MenuIcon className={classes.navigationIcon} />}
            onClick={onOpenMobileNavigation}
          />
        </Tooltip>

        <Tooltip title={sidebarToggleLabel}>
          <Button
            type="text"
            shape="circle"
            size="large"
            className={classes.desktopNavigationButton}
            aria-label={sidebarToggleLabel}
            aria-expanded={!sidebarCollapsed}
            aria-controls={sidebarId}
            icon={sidebarCollapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            onClick={onToggleSidebar}
          />
        </Tooltip>

        <NavLink to="/dashboard" className={classes.brandLink} aria-label="File Central dashboard">
          <span className={classes.brandMark}>
            <Cloud className={classes.brandIcon} />
          </span>
          <span className={classes.brandName}>
            File <span className={classes.brandNameMuted}>Central</span>
          </span>
        </NavLink>

        <div className={classes.searchRegion}>
          <Input.Search
            allowClear
            value={searchState.value}
            placeholder="Search in Drive"
            aria-label="Search in Drive"
            className={classes.search}
            classNames={{
              input: classes.searchInput,
              button: { root: classes.searchButton },
            }}
            onChange={(event) => setSearchState({ urlQuery: urlSearchQuery, value: event.target.value })}
            onSearch={handleSearch}
          />
        </div>

        <div className={classes.headerActions}>
          <span className={classes.themeAction}>
            <ModeToggle />
          </span>

          <Dropdown menu={{ items: accountItems }} placement="bottomRight" trigger={["click"]}>
            <Tooltip title={logout.isPending ? "Signing out…" : "Account"}>
              <Button
                type="text"
                shape="circle"
                className={classes.accountButton}
                aria-label="Open account menu"
                disabled={logout.isPending}
              >
                {logout.isPending ? (
                  <LoadingOutlined spin className={classes.loadingIcon} />
                ) : (
                  <Avatar size={36} src={currentUser?.avatarUrl} className={classes.avatar}>
                    {initials}
                  </Avatar>
                )}
              </Button>
            </Tooltip>
          </Dropdown>
        </div>
      </div>
    </Layout.Header>
  );
}

function getInitials(value: string) {
  const words = value.trim().split(/\s+/).filter(Boolean);

  if (words.length === 0) {
    return "U";
  }

  if (words.length === 1) {
    return words[0].slice(0, 2).toUpperCase();
  }

  return `${words[0][0]}${words.at(-1)?.[0] ?? ""}`.toUpperCase();
}

export default DashboardHeader;
