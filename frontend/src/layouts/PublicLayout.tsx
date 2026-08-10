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
import classes from "./PublicLayout.module.css";


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
    <Layout className={classes.layout}>
      <Layout.Header className={classes.header}>
        <div className={classes.spreadRow}>
          <Brand />

          <Menu
            mode="horizontal"
            items={navigationItems}
            selectedKeys={location.pathname === "/" && !location.hash ? ["home"] : []}
            onClick={handleNavigation}
            className={classes.centeredRow}
          />

          <Space size={6} className={classes.space}>
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

          <Space size={2} className={classes.space2}>
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

      <Layout.Content className={classes.content}>
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
          className={classes.menu}
        />
        <Space direction="vertical" size={10} className={classes.fullWidth}>
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
    <Link to="/" aria-label="File Central home" className={classes.row}>
      <span className={classes.centeredRow2}>
        <CloudOutlined className={classes.icon} />
      </span>
      <Typography.Text className={classes.text}>
        File <span className={classes.span}>Central</span>
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
        <div className={classes.div}>
          <Typography.Text strong className={classes.truncatedText}>{displayName}</Typography.Text>
          {user?.email && <Typography.Text type="secondary" className={classes.truncatedText2}>{user.email}</Typography.Text>}
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
      <Button type="text" className={compact ? classes.button : classes.button2} aria-label="Open account menu">
        <Flex align="center" gap={8}>
          <Avatar size={32} src={user?.avatarUrl} className={classes.avatar}>{getInitials(displayName)}</Avatar>
          {!compact && <Typography.Text strong className={classes.truncatedText3}>{displayName}</Typography.Text>}
        </Flex>
      </Button>
    </Dropdown>
  );
}

function PublicFooter({ authenticated, onNavigate, onSignOut }: { authenticated: boolean; onNavigate: (to: string) => void; onSignOut: () => Promise<void> }) {
  return (
    <Layout.Footer className={classes.footer}>
      <div className={classes.responsiveGrid}>
        <div className={classes.div2}>
          <Brand />
          <Typography.Paragraph type="secondary" className={classes.paragraph}>
            A centralized workspace for storing, organizing, sharing, and protecting your files.
          </Typography.Paragraph>
        </div>
        <FooterGroup title="Product" links={[{ label: "Features", target: "/#features" }, { label: "Security", target: "/#security" }]} onNavigate={onNavigate} />
        <div>
          <Typography.Text strong>Account</Typography.Text>
          <Space direction="vertical" size={10} className={classes.row2}>
            {authenticated ? (
              <>
                <Button type="link" className={classes.button3} onClick={() => onNavigate("/dashboard")}>Dashboard</Button>
                <Button type="link" danger className={classes.button3} onClick={() => void onSignOut()}>Sign out</Button>
              </>
            ) : (
              <>
                <Button type="link" className={classes.button3} onClick={() => onNavigate("/auth/login")}>Sign in</Button>
                <Button type="link" className={classes.button3} onClick={() => onNavigate("/auth/register")}>Create an account</Button>
              </>
            )}
          </Space>
        </div>
      </div>
      <div className={classes.div3}>
        <div className={classes.column}>
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
      <Space direction="vertical" size={10} className={classes.row2}>
        {links.map((link) => (
          <Button key={link.target} type="link" className={classes.button3} onClick={() => onNavigate(link.target)}>{link.label}</Button>
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
