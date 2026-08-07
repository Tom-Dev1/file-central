import {
  ArrowRightOutlined,
  CheckCircleFilled,
  CloudOutlined,
  DownloadOutlined,
  FolderOpenOutlined,
  HddOutlined,
  LinkOutlined,
  LockOutlined,
  SafetyCertificateOutlined,
  ShareAltOutlined,
  UploadOutlined,
  UsergroupAddOutlined,
} from "@ant-design/icons";
import { Button, Card, Col, Flex, Row, Space, Statistic, Tag, Typography, theme } from "antd";
import { useNavigate } from "react-router-dom";

import { tokenStorage } from "@/lib/token-storage";

const features = [
  { icon: <UploadOutlined />, title: "Fast uploads", description: "Upload files and keep every project in one centralized workspace." },
  { icon: <FolderOpenOutlined />, title: "Folder management", description: "Create a structure that stays clear as your workspace grows." },
  { icon: <ShareAltOutlined />, title: "Easy sharing", description: "Share resources with teammates or through controlled public links." },
  { icon: <LockOutlined />, title: "Access control", description: "Choose who can view, download, edit, or manage shared content." },
  { icon: <DownloadOutlined />, title: "Reliable access", description: "Preview and download the files you need from any trusted device." },
  { icon: <SafetyCertificateOutlined />, title: "Data protection", description: "Keep sensitive work protected with clear authentication boundaries." },
];

const benefits = [
  "Centralized file and folder management",
  "Secure links with clear permissions",
  "Fast previews and resumable uploads",
  "Access across desktop and mobile",
];

function HomePage() {
  const navigate = useNavigate();
  const { token } = theme.useToken();
  const authenticated = tokenStorage.hasAccessToken();
  const primaryTarget = authenticated ? "/dashboard" : "/auth/register";

  return (
    <>
      <section className="relative overflow-hidden border-b border-border">
        <div
          aria-hidden="true"
          className="absolute inset-0"
          style={{
            background: `radial-gradient(circle at 12% 16%, ${token.colorPrimaryBg}, transparent 32%), radial-gradient(circle at 88% 74%, ${token.colorInfoBg}, transparent 30%), linear-gradient(180deg, ${token.colorBgContainer}, ${token.colorBgLayout})`,
          }}
        />
        <div aria-hidden="true" className="absolute inset-0 opacity-30 [background-image:linear-gradient(var(--border)_1px,transparent_1px),linear-gradient(90deg,var(--border)_1px,transparent_1px)] [background-size:48px_48px] [mask-image:linear-gradient(to_bottom,black,transparent_90%)]" />

        <div className="relative mx-auto grid min-h-[calc(100svh-4rem)] w-full max-w-7xl items-center gap-14 px-4 py-16 sm:px-6 lg:grid-cols-[1.02fr_.98fr] lg:px-8 lg:py-24">
          <div>
            <Tag color="blue" icon={<CloudOutlined />} className="!mb-6 !rounded-full !px-3 !py-1">
              Secure cloud workspace
            </Tag>
            <Typography.Title className="!mb-0 max-w-3xl !text-4xl !leading-[1.08] sm:!text-5xl lg:!text-6xl">
              Your files, organized <span style={{ color: token.colorPrimary }}>without the clutter.</span>
            </Typography.Title>
            <Typography.Paragraph type="secondary" className="!mb-0 !mt-6 max-w-xl !text-base !leading-7 sm:!text-lg">
              File Central brings uploads, folders, previews, sharing, and access control into one focused workspace.
            </Typography.Paragraph>

            <Space wrap size={12} className="mt-8">
              <Button type="primary" size="large" icon={<ArrowRightOutlined />} iconPosition="end" onClick={() => navigate(primaryTarget)}>
                {authenticated ? "Open Dashboard" : "Get started for free"}
              </Button>
              {!authenticated && <Button size="large" onClick={() => navigate("/auth/login")}>Sign in</Button>}
            </Space>

            <Flex wrap gap={20} className="mt-8">
              {["Quick setup", "No installation", "Available anywhere"].map((item) => (
                <Flex key={item} align="center" gap={8}>
                  <CheckCircleFilled style={{ color: token.colorPrimary }} />
                  <Typography.Text type="secondary">{item}</Typography.Text>
                </Flex>
              ))}
            </Flex>
          </div>

          <ProductPreview />
        </div>
      </section>

      <section id="features" className="scroll-mt-20 border-b border-border bg-muted/30 py-20 sm:py-24">
        <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <Tag>Features</Tag>
            <Typography.Title level={2} className="!mb-0 !mt-4 !text-3xl sm:!text-4xl">
              Everything your file workflow needs
            </Typography.Title>
            <Typography.Paragraph type="secondary" className="!mt-4 !text-base !leading-7">
              Purpose-built tools for storing, finding, and sharing work without switching contexts.
            </Typography.Paragraph>
          </div>

          <Row gutter={[20, 20]} className="mt-10">
            {features.map((feature) => (
              <Col xs={24} md={12} lg={8} key={feature.title}>
                <Card hoverable className="h-full" styles={{ body: { padding: 24 } }}>
                  <Flex vertical gap={14}>
                    <span className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-xl text-primary">{feature.icon}</span>
                    <Typography.Title level={4} className="!mb-0">{feature.title}</Typography.Title>
                    <Typography.Paragraph type="secondary" className="!mb-0 !leading-6">{feature.description}</Typography.Paragraph>
                  </Flex>
                </Card>
              </Col>
            ))}
          </Row>
        </div>
      </section>

      <section id="security" className="scroll-mt-20 py-20 sm:py-24">
        <div className="mx-auto grid w-full max-w-7xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-2 lg:px-8">
          <div className="relative overflow-hidden rounded-3xl border border-border bg-muted/30 p-8 sm:p-12">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,var(--accent),transparent_58%)] opacity-70" />
            <div className="relative mx-auto flex aspect-square max-w-sm items-center justify-center rounded-full border border-border bg-background shadow-xl">
              <div className="flex size-40 items-center justify-center rounded-full bg-primary/10 text-primary">
                <SafetyCertificateOutlined className="text-7xl" />
              </div>
            </div>
          </div>
          <div>
            <Tag>Safe by design</Tag>
            <Typography.Title level={2} className="!mb-0 !mt-4 !text-3xl sm:!text-4xl">
              Your data stays under your control
            </Typography.Title>
            <Typography.Paragraph type="secondary" className="!mt-5 !text-base !leading-7">
              Manage resources, collaborators, public links, and download permissions from one consistent system.
            </Typography.Paragraph>
            <Space direction="vertical" size={15} className="mt-6 flex">
              {benefits.map((benefit) => (
                <Flex key={benefit} align="center" gap={12}>
                  <CheckCircleFilled style={{ color: token.colorPrimary }} />
                  <Typography.Text strong>{benefit}</Typography.Text>
                </Flex>
              ))}
            </Space>
            <Button type="primary" className="mt-8" icon={<ArrowRightOutlined />} iconPosition="end" onClick={() => navigate(primaryTarget)}>
              {authenticated ? "Go to Dashboard" : "Create an account"}
            </Button>
          </div>
        </div>
      </section>

      <section className="px-4 pb-20 sm:px-6 sm:pb-24 lg:px-8">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-8 rounded-3xl bg-primary px-6 py-12 text-center text-primary-foreground sm:px-10 lg:flex-row lg:text-left">
          <div>
            <Typography.Title level={2} className="!mb-0 !text-white">Ready for a calmer file workflow?</Typography.Title>
            <Typography.Text className="!mt-2 block !text-white/75">Start with a focused workspace that grows with your team.</Typography.Text>
          </div>
          <Button size="large" onClick={() => navigate(primaryTarget)}>{authenticated ? "Open Dashboard" : "Get started now"}</Button>
        </div>
      </section>
    </>
  );
}

function ProductPreview() {
  const files = [
    { name: "Project documents", detail: "Folder", icon: <FolderOpenOutlined /> },
    { name: "Quarterly report.pdf", detail: "PDF · 3.2 MB", icon: <LockOutlined /> },
    { name: "Product design.fig", detail: "FIG · 18.5 MB", icon: <CloudOutlined /> },
    { name: "Team directory.xlsx", detail: "XLSX · 1.8 MB", icon: <UsergroupAddOutlined /> },
  ];
  return (
    <div className="relative">
      <div className="absolute -inset-10 rounded-full bg-primary/10 blur-3xl" />
      <Card className="relative overflow-hidden shadow-2xl" styles={{ body: { padding: 0 } }}>
        <Flex align="center" justify="space-between" className="border-b border-border bg-muted/30 px-5 py-4">
          <div><Typography.Text strong>My Drive</Typography.Text><Typography.Text type="secondary" className="block !text-xs">Recently managed</Typography.Text></div>
          <Tag color="processing" icon={<CloudOutlined />}>Synced</Tag>
        </Flex>
        <div className="p-5">
          <Row gutter={10}>
            <Col span={8}><Summary icon={<HddOutlined />} title="Used" value="4.8 GB" /></Col>
            <Col span={8}><Summary icon={<FolderOpenOutlined />} title="Folders" value={24} /></Col>
            <Col span={8}><Summary icon={<LinkOutlined />} title="Shared" value={12} /></Col>
          </Row>
          <Space direction="vertical" size={10} className="mt-5 flex">
            {files.map((file) => (
              <Flex key={file.name} align="center" gap={12} className="rounded-xl border border-border p-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-lg text-primary">{file.icon}</span>
                <div className="min-w-0"><Typography.Text strong ellipsis className="block">{file.name}</Typography.Text><Typography.Text type="secondary" className="!text-xs">{file.detail}</Typography.Text></div>
              </Flex>
            ))}
          </Space>
        </div>
      </Card>
    </div>
  );
}

function Summary({ icon, title, value }: { icon: React.ReactNode; title: string; value: string | number }) {
  return <Card size="small" className="h-full"><span className="text-primary">{icon}</span><Statistic title={title} value={value} valueStyle={{ fontSize: 17, fontWeight: 650 }} /></Card>;
}

export default HomePage;
