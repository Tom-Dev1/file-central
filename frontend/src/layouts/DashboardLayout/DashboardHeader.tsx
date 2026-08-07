import { LoadingOutlined } from "@ant-design/icons";
import { App, Avatar, Button, Dropdown, Input, Layout, Tooltip, Typography, type MenuProps } from "antd";
import { Cloud, LogOut, Menu as MenuIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";

import { ModeToggle } from "@/components/theme/ModeToggle";
import { useLogout } from "@/hooks/useAuth";
import { authUserStorage, type StoredUser } from "@/lib/authUserStorage";

interface DashboardHeaderProps {
  onOpenNavigation: () => void;
}

function DashboardHeader({ onOpenNavigation }: DashboardHeaderProps) {
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
        <div className="min-w-48 py-1">
          <Typography.Text strong className="block truncate">
            {displayName}
          </Typography.Text>
          {currentUser?.email && (
            <Typography.Text type="secondary" className="block truncate !text-xs">
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
      icon: logout.isPending ? <LoadingOutlined spin /> : <LogOut className="size-4" />,
      label: logout.isPending ? "Signing out…" : "Sign out",
      onClick: () => void handleLogout(),
    },
  ];

  return (
    <Layout.Header className="z-30 !h-16 !shrink-0 border-b border-border/70 !bg-background !px-0 !leading-normal">
      <div className="flex h-full min-w-0 items-center gap-2 px-3 sm:gap-3 sm:px-4">
        <Tooltip title="Open navigation">
          <Button
            type="text"
            shape="circle"
            size="large"
            className="!inline-flex !shrink-0 lg:!hidden"
            aria-label="Open navigation menu"
            icon={<MenuIcon className="size-5" />}
            onClick={onOpenNavigation}
          />
        </Tooltip>

        <NavLink to="/dashboard" className="flex shrink-0 items-center gap-2.5 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-primary">
          <span className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Cloud className="size-5" />
          </span>
          <span className="hidden text-[1.375rem] font-normal tracking-tight text-foreground xl:block">
            File <span className="font-medium text-muted-foreground">Central</span>
          </span>
        </NavLink>

        <div className="mx-auto w-full min-w-0 max-w-2xl">
          <Input.Search
            allowClear
            value={searchState.value}
            placeholder="Search in Drive"
            aria-label="Search in Drive"
            className="[&_.ant-input-affix-wrapper]:!h-11 [&_.ant-input-affix-wrapper]:!rounded-l-full [&_.ant-input-affix-wrapper]:!border-transparent [&_.ant-input-affix-wrapper]:!bg-muted [&_.ant-input-affix-wrapper]:!pl-4 [&_.ant-input-search-button]:!h-11 [&_.ant-input-search-button]:!rounded-r-full [&_.ant-input-search-button]:!border-transparent [&_.ant-input-search-button]:!bg-muted focus-within:[&_.ant-input-affix-wrapper]:!border-primary/40"
            onChange={(event) => setSearchState({ urlQuery: urlSearchQuery, value: event.target.value })}
            onSearch={handleSearch}
          />
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <span className="inline-flex">
            <ModeToggle />
          </span>

          <Dropdown menu={{ items: accountItems }} placement="bottomRight" trigger={["click"]}>
            <Tooltip title={logout.isPending ? "Signing out…" : "Account"}>
              <Button
                type="text"
                shape="circle"
                className="!size-10 !p-0"
                aria-label="Open account menu"
                disabled={logout.isPending}
              >
                {logout.isPending ? (
                  <LoadingOutlined spin className="text-lg" />
                ) : (
                  <Avatar size={36} src={currentUser?.avatarUrl} className="!bg-primary !text-primary-foreground">
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
