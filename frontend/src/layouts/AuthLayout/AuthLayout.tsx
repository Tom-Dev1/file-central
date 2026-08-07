import {
  CheckCircleFilled,
  CloudServerOutlined,
  LockOutlined,
  SafetyCertificateOutlined,
  SyncOutlined,
} from "@ant-design/icons";
import { Flex, Grid, Space, Typography, theme } from "antd";
import { Link, Outlet } from "react-router-dom";

import { ModeToggle } from "@/components/theme/ModeToggle";

const features = [
  {
    icon: <LockOutlined />,
    title: "Private by default",
    description: "Your workspace stays protected with secure authentication and controlled access.",
  },
  {
    icon: <SafetyCertificateOutlined />,
    title: "Access you control",
    description: "Keep files organized and share only with the people who should have access.",
  },
  {
    icon: <SyncOutlined />,
    title: "Available everywhere",
    description: "Continue working with your files from any trusted device.",
  },
];

function Brand({ inverse = false }: { inverse?: boolean }) {
  return (
    <Link
      to="/"
      aria-label="File Central home"
      style={{ color: inverse ? "#ffffff" : "inherit", textDecoration: "none" }}
    >
      <Flex align="center" gap={12}>
        <Flex
          align="center"
          justify="center"
          style={{
            width: 40,
            height: 40,
            borderRadius: 12,
            color: inverse ? "#0f3b72" : "#ffffff",
            background: inverse ? "#ffffff" : "#1a73e8",
            boxShadow: inverse ? "0 8px 30px rgba(0, 0, 0, 0.18)" : "0 8px 24px rgba(26, 115, 232, 0.24)",
          }}
        >
          <CloudServerOutlined style={{ fontSize: 21 }} />
        </Flex>
        <Typography.Text strong style={{ color: "inherit", fontSize: 18 }}>
          File Central
        </Typography.Text>
      </Flex>
    </Link>
  );
}

function AuthLayout() {
  const screens = Grid.useBreakpoint();
  const { token } = theme.useToken();
  const isDesktop = Boolean(screens.lg);

  return (
    <div
      className="min-h-svh"
      style={{
        display: "grid",
        gridTemplateColumns: isDesktop ? "minmax(440px, 0.92fr) minmax(520px, 1.08fr)" : "1fr",
        background: token.colorBgLayout,
      }}
    >
      {isDesktop && (
        <aside
          aria-label="File Central security features"
          style={{
            position: "relative",
            display: "flex",
            minHeight: "100svh",
            overflow: "hidden",
            padding: "42px clamp(42px, 5vw, 76px)",
            color: "#ffffff",
            background:
              "radial-gradient(circle at 12% 18%, rgba(85, 161, 255, 0.34), transparent 28%), radial-gradient(circle at 88% 82%, rgba(37, 99, 235, 0.32), transparent 34%), linear-gradient(145deg, #071a33 0%, #0d3262 52%, #0a2141 100%)",
          }}
        >
          <div
            aria-hidden="true"
            style={{
              position: "absolute",
              inset: 0,
              opacity: 0.18,
              backgroundImage:
                "linear-gradient(rgba(255,255,255,.08) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.08) 1px, transparent 1px)",
              backgroundSize: "44px 44px",
              maskImage: "linear-gradient(to bottom, black, transparent 86%)",
            }}
          />

          <Flex vertical style={{ position: "relative", zIndex: 1, width: "100%" }}>
            <Brand inverse />

            <div style={{ margin: "auto 0", maxWidth: 570, padding: "70px 0" }}>
              <Typography.Text
                style={{ color: "#8fc5ff", fontSize: 12, fontWeight: 700, letterSpacing: "0.18em" }}
              >
                SECURE CLOUD WORKSPACE
              </Typography.Text>
              <Typography.Title
                level={1}
                style={{ color: "#ffffff", fontSize: "clamp(38px, 4vw, 58px)", lineHeight: 1.06, margin: "18px 0 18px" }}
              >
                Your files, protected and always within reach.
              </Typography.Title>
              <Typography.Paragraph style={{ color: "#c8d9ee", fontSize: 16, lineHeight: 1.75, maxWidth: 530 }}>
                A focused place to store, organize, and share important work without losing control of your data.
              </Typography.Paragraph>

              <Space direction="vertical" size={24} style={{ display: "flex", marginTop: 38 }}>
                {features.map((feature) => (
                  <Flex key={feature.title} align="flex-start" gap={16}>
                    <Flex
                      align="center"
                      justify="center"
                      style={{
                        flex: "0 0 auto",
                        width: 42,
                        height: 42,
                        border: "1px solid rgba(255,255,255,.16)",
                        borderRadius: 12,
                        color: "#8fc5ff",
                        background: "rgba(255,255,255,.08)",
                        fontSize: 18,
                      }}
                    >
                      {feature.icon}
                    </Flex>
                    <div>
                      <Typography.Text strong style={{ color: "#ffffff", fontSize: 15 }}>
                        {feature.title}
                      </Typography.Text>
                      <Typography.Paragraph style={{ color: "#9fb7d2", lineHeight: 1.6, margin: "4px 0 0" }}>
                        {feature.description}
                      </Typography.Paragraph>
                    </div>
                  </Flex>
                ))}
              </Space>
            </div>

            <Flex align="center" gap={9} style={{ color: "#b7cae0", fontSize: 13 }}>
              <CheckCircleFilled style={{ color: "#55d6a5" }} />
              Your account data is encrypted in transit.
            </Flex>
          </Flex>
        </aside>
      )}

      <main
        style={{
          position: "relative",
          display: "flex",
          minWidth: 0,
          minHeight: "100svh",
          alignItems: "center",
          justifyContent: "center",
          padding: isDesktop ? "56px clamp(40px, 7vw, 96px)" : "84px 18px 34px",
        }}
      >
        <div style={{ position: "absolute", right: isDesktop ? 28 : 16, top: isDesktop ? 24 : 14 }}>
          <ModeToggle />
        </div>

        {!isDesktop && (
          <div style={{ position: "absolute", left: 18, top: 16 }}>
            <Brand />
          </div>
        )}

        <div style={{ width: "100%", maxWidth: 470 }}>
          <Outlet />
        </div>
      </main>
    </div>
  );
}

export default AuthLayout;
