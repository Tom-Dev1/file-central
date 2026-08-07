import {
  App,
  Avatar,
  Button,
  Drawer,
  Dropdown,
  Flex,
  Layout,
  Menu,
  Space,
  Typography,
  type MenuProps,
} from "antd";
import {
  CloudOutlined,
  DashboardOutlined,
  LoadingOutlined,
  LoginOutlined,
  LogoutOutlined,
  MenuOutlined,
  UserAddOutlined,
} from "@ant-design/icons";
import { useEffect, useState } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";

import { ModeToggle } from "@/components/theme/ModeToggle";
import { useLogout } from "@/hooks/useAuth";
import { authUserStorage, type StoredUser } from "@/lib/authUserStorage";
import { tokenStorage } from "@/lib/token-storage";

const publicNavigation = [
  { key: "home", label: "Home", target: "/" },
  { key: "features", label: "Features", target: "/#features" },
  { key: "security", label: "Security", target: "/#security" },
] as const;

function PublicLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const logout = useLogout();
  const { message } = App.useApp();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<StoredUser | null>(() => authUserStorage.getUser());
  const isAuthenticated = tokenStorage.hasAccessToken();

  useEffect(() => {
    const synchronizeAuthentication = () => setCurrentUser(authUserStorage.getUser());
    window.addEventListener("storage", synchronizeAuthentication);
    return () => window.removeEventListener("storage", synchronizeAuthentication);
  }, []);

  const navigateTo = (target: string) => {
    setMobileMenuOpen(false);
    if (target.startsWith("/#")) {
      if (location.pathname !== "/") {
        navigate(target);
      } else {
        document.getElementById(target.slice(2))?.scrollIntoView({ behavior: "smooth", block: "start" });
        window.history.replaceState(null, "", target);
      }
      return;
    }
    navigate(target);
  };

  const handleSignOut = async () => {
    try {
      await logout.mutateAsync();
      setCurrentUser(null);
      setMobileMenuOpen(false);
      navigate("/auth/login", { replace: true });
    } catch {
      void message.error("Unable to sign out. Please try again.");
    }
  };

  const navigationItems: MenuProps["items"] = publicNavigation.map((item) => ({
    key: item.key,
    label: item.label,
  }));

  const handleNavigation: MenuProps["onClick"] = ({ key }) => {
    const item = publicNavigation.find((candidate) => candidate.key === key);
    if (item) navigateTo(item.target);
  };

  return (
    <Layout className="min-h-screen !bg-background !text-foreground">
      <Layout.Header className="sticky top-0 z-50 !h-16 border-b border-border/70 !bg-background/95 !px-0 !leading-normal backdrop-blur">
        <div className="mx-auto flex h-full w-full max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <Brand />

          <Menu
            mode="horizontal"
            items={navigationItems}
            selectedKeys={location.pathname === "/" && !location.hash ? ["home"] : []}
            onClick={handleNavigation}
            className="!hidden min-w-0 flex-1 justify-center !border-0 !bg-transparent md:!flex"
          />

          <Space size={6} className="!hidden md:!flex">
            <ModeToggle />
            {isAuthenticated ? (
              <UserMenu user={currentUser} pending={logout.isPending} onNavigate={navigate} onSignOut={handleSignOut} />
            ) : (
              <>
                <Button type="text" icon={<LoginOutlined />} onClick={() => navigate("/auth/login")}>
                  Sign in
                </Button>
                <Button type="primary" icon={<UserAddOutlined />} onClick={() => navigate("/auth/register")}>
                  Get started
                </Button>
              </>
            )}
          </Space>

          <Space size={2} className="md:!hidden">
            <ModeToggle />
            {isAuthenticated && (
              <UserMenu user={currentUser} pending={logout.isPending} onNavigate={navigate} onSignOut={handleSignOut} compact />
            )}
            <Button
              type="text"
              shape="circle"
              size="large"
              aria-label="Open navigation menu"
              icon={<MenuOutlined />}
              onClick={() => setMobileMenuOpen(true)}
            />
          </Space>
        </div>
      </Layout.Header>

      <Layout.Content className="relative !bg-background">
        <Outlet />
      </Layout.Content>

      <PublicFooter authenticated={isAuthenticated} onNavigate={navigateTo} onSignOut={handleSignOut} />

      <Drawer
        title={<Brand />}
        placement="right"
        width="min(360px, calc(100vw - 24px))"
        open={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
        styles={{ body: { display: "flex", flexDirection: "column", padding: 16 } }}
      >
        <Menu
          mode="inline"
          items={navigationItems}
          selectedKeys={location.pathname === "/" ? ["home"] : []}
          onClick={handleNavigation}
          className="!border-0"
        />
        <Space direction="vertical" size={10} className="mt-auto w-full border-t border-border pt-4">
          {isAuthenticated ? (
            <>
              <Button block icon={<DashboardOutlined />} onClick={() => navigateTo("/dashboard")}>
                Dashboard
              </Button>
              <Button block danger loading={logout.isPending} icon={<LogoutOutlined />} onClick={() => void handleSignOut()}>
                Sign out
              </Button>
            </>
          ) : (
            <>
              <Button block icon={<LoginOutlined />} onClick={() => navigateTo("/auth/login")}>
                Sign in
              </Button>
              <Button block type="primary" icon={<UserAddOutlined />} onClick={() => navigateTo("/auth/register")}>
                Get started
              </Button>
            </>
          )}
        </Space>
      </Drawer>
    </Layout>
  );
}

function Brand() {
  return (
    <Link to="/" aria-label="File Central home" className="flex shrink-0 items-center gap-2.5 text-foreground">
      <span className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <CloudOutlined className="text-lg" />
      </span>
      <Typography.Text className="!text-lg">
        File <span className="font-medium text-muted-foreground">Central</span>
      </Typography.Text>
    </Link>
  );
}

interface UserMenuProps {
  user: StoredUser | null;
  pending: boolean;
  compact?: boolean;
  onNavigate: (to: string) => void;
  onSignOut: () => Promise<void>;
}

function UserMenu({ user, pending, compact = false, onNavigate, onSignOut }: UserMenuProps) {
  const displayName = user?.name || user?.username || user?.email || "User";
  const items: MenuProps["items"] = [
    {
      key: "identity",
      disabled: true,
      label: (
        <div className="min-w-48 py-1">
          <Typography.Text strong className="block truncate">{displayName}</Typography.Text>
          {user?.email && <Typography.Text type="secondary" className="block truncate !text-xs">{user.email}</Typography.Text>}
        </div>
      ),
    },
    { type: "divider" },
    { key: "dashboard", icon: <DashboardOutlined />, label: "Dashboard" },
    { type: "divider" },
    {
      key: "logout",
      danger: true,
      disabled: pending,
      icon: pending ? <LoadingOutlined spin /> : <LogoutOutlined />,
      label: pending ? "Signing out..." : "Sign out",
    },
  ];

  const handleMenuClick: MenuProps["onClick"] = ({ key }) => {
    if (key === "dashboard") onNavigate("/dashboard");
    if (key === "logout") void onSignOut();
  };

  return (
    <Dropdown menu={{ items, onClick: handleMenuClick }} placement="bottomRight" trigger={["click"]}>
      <Button type="text" className={compact ? "!size-10 !p-0" : "!h-10 !px-2"} aria-label="Open account menu">
        <Flex align="center" gap={8}>
          <Avatar size={32} src={user?.avatarUrl} className="!bg-primary">{getInitials(displayName)}</Avatar>
          {!compact && <Typography.Text strong className="max-w-28 truncate">{displayName}</Typography.Text>}
        </Flex>
      </Button>
    </Dropdown>
  );
}

function PublicFooter({ authenticated, onNavigate, onSignOut }: { authenticated: boolean; onNavigate: (to: string) => void; onSignOut: () => Promise<void> }) {
  return (
    <Layout.Footer className="border-t border-border !bg-muted/30 !px-0 !py-0">
      <div className="mx-auto grid w-full max-w-7xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-2 lg:grid-cols-4 lg:px-8">
        <div className="lg:col-span-2">
          <Brand />
          <Typography.Paragraph type="secondary" className="!mt-4 max-w-md !leading-6">
            A centralized workspace for storing, organizing, sharing, and protecting your files.
          </Typography.Paragraph>
        </div>
        <FooterGroup title="Product" links={[{ label: "Features", target: "/#features" }, { label: "Security", target: "/#security" }]} onNavigate={onNavigate} />
        <div>
          <Typography.Text strong>Account</Typography.Text>
          <Space direction="vertical" size={10} className="mt-4 flex">
            {authenticated ? (
              <>
                <Button type="link" className="!h-auto !p-0" onClick={() => onNavigate("/dashboard")}>Dashboard</Button>
                <Button type="link" danger className="!h-auto !p-0" onClick={() => void onSignOut()}>Sign out</Button>
              </>
            ) : (
              <>
                <Button type="link" className="!h-auto !p-0" onClick={() => onNavigate("/auth/login")}>Sign in</Button>
                <Button type="link" className="!h-auto !p-0" onClick={() => onNavigate("/auth/register")}>Create an account</Button>
              </>
            )}
          </Space>
        </div>
      </div>
      <div className="border-t border-border">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-6 text-sm text-muted-foreground sm:px-6 md:flex-row md:justify-between lg:px-8">
          <span>© 2026 File Central. All rights reserved.</span>
          <span>Store and share your files securely.</span>
        </div>
      </div>
    </Layout.Footer>
  );
}

function FooterGroup({ title, links, onNavigate }: { title: string; links: Array<{ label: string; target: string }>; onNavigate: (to: string) => void }) {
  return (
    <div>
      <Typography.Text strong>{title}</Typography.Text>
      <Space direction="vertical" size={10} className="mt-4 flex">
        {links.map((link) => (
          <Button key={link.target} type="link" className="!h-auto !p-0" onClick={() => onNavigate(link.target)}>{link.label}</Button>
        ))}
      </Space>
    </div>
  );
}

function getInitials(value: string) {
  const words = value.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "U";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return `${words[0][0]}${words.at(-1)?.[0] ?? ""}`.toUpperCase();
}

export default PublicLayout;
