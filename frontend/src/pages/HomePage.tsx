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
import classes from "./HomePage.module.css";

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
      <section className={classes.hero}>
        <div
          aria-hidden="true"
          className={classes.heroGradient}
          style={{
            background: `radial-gradient(circle at 12% 16%, ${token.colorPrimaryBg}, transparent 32%), radial-gradient(circle at 88% 74%, ${token.colorInfoBg}, transparent 30%), linear-gradient(180deg, ${token.colorBgContainer}, ${token.colorBgLayout})`,
          }}
        />
        <div aria-hidden="true" className={classes.heroGrid} />

        <div className={classes.heroInner}>
          <div>
            <Tag color="blue" icon={<CloudOutlined />} className={classes.heroTag}>
              Secure cloud workspace
            </Tag>
            <Typography.Title className={classes.heroTitle}>
              Your files, organized <span style={{ color: token.colorPrimary }}>without the clutter.</span>
            </Typography.Title>
            <Typography.Paragraph type="secondary" className={classes.heroDescription}>
              File Central brings uploads, folders, previews, sharing, and access control into one focused workspace.
            </Typography.Paragraph>

            <Space wrap size={12} className={classes.securityButton}>
              <Button type="primary" size="large" icon={<ArrowRightOutlined />} iconPosition="end" onClick={() => navigate(primaryTarget)}>
                {authenticated ? "Open Dashboard" : "Get started for free"}
              </Button>
              {!authenticated && <Button size="large" onClick={() => navigate("/auth/login")}>Sign in</Button>}
            </Space>

            <Flex wrap gap={20} className={classes.securityButton}>
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

      <section id="features" className={classes.features}>
        <div className={classes.container}>
          <div className={classes.sectionHeading}>
            <Tag>Features</Tag>
            <Typography.Title level={2} className={classes.sectionTitle}>
              Everything your file workflow needs
            </Typography.Title>
            <Typography.Paragraph type="secondary" className={classes.sectionDescription}>
              Purpose-built tools for storing, finding, and sharing work without switching contexts.
            </Typography.Paragraph>
          </div>

          <Row gutter={[20, 20]} className={classes.featureGrid}>
            {features.map((feature) => (
              <Col xs={24} md={12} lg={8} key={feature.title}>
                <Card hoverable className={classes.fullHeight} styles={{ body: { padding: 24 } }}>
                  <Flex vertical gap={14}>
                    <span className={classes.featureIcon}>{feature.icon}</span>
                    <Typography.Title level={4} className={classes.noMarginBottom}>{feature.title}</Typography.Title>
                    <Typography.Paragraph type="secondary" className={classes.featureDescription}>{feature.description}</Typography.Paragraph>
                  </Flex>
                </Card>
              </Col>
            ))}
          </Row>
        </div>
      </section>

      <section id="security" className={classes.security}>
        <div className={classes.securityInner}>
          <div className={classes.securityVisual}>
            <div className={classes.securityGlow} />
            <div className={classes.securityCircle}>
              <div className={classes.certificate}>
                <SafetyCertificateOutlined className={classes.certificateIcon} />
              </div>
            </div>
          </div>
          <div>
            <Tag>Safe by design</Tag>
            <Typography.Title level={2} className={classes.sectionTitle}>
              Your data stays under your control
            </Typography.Title>
            <Typography.Paragraph type="secondary" className={classes.securityDescription}>
              Manage resources, collaborators, public links, and download permissions from one consistent system.
            </Typography.Paragraph>
            <Space direction="vertical" size={15} className={classes.benefitList}>
              {benefits.map((benefit) => (
                <Flex key={benefit} align="center" gap={12}>
                  <CheckCircleFilled style={{ color: token.colorPrimary }} />
                  <Typography.Text strong>{benefit}</Typography.Text>
                </Flex>
              ))}
            </Space>
            <Button type="primary" className={classes.securityButton} icon={<ArrowRightOutlined />} iconPosition="end" onClick={() => navigate(primaryTarget)}>
              {authenticated ? "Go to Dashboard" : "Create an account"}
            </Button>
          </div>
        </div>
      </section>

      <section className={classes.ctaSection}>
        <div className={classes.ctaPanel}>
          <div>
            <Typography.Title level={2} className={classes.ctaTitle}>Ready for a calmer file workflow?</Typography.Title>
            <Typography.Text className={classes.ctaText}>Start with a focused workspace that grows with your team.</Typography.Text>
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
    <div className={classes.previewRoot}>
      <div className={classes.previewGlow} />
      <Card className={classes.previewCard} styles={{ body: { padding: 0 } }}>
        <Flex align="center" justify="space-between" className={classes.previewHeader}>
          <div><Typography.Text strong>My Drive</Typography.Text><Typography.Text type="secondary" className={classes.smallBlock}>Recently managed</Typography.Text></div>
          <Tag color="processing" icon={<CloudOutlined />}>Synced</Tag>
        </Flex>
        <div className={classes.previewBody}>
          <Row gutter={10}>
            <Col span={8}><Summary icon={<HddOutlined />} title="Used" value="4.8 GB" /></Col>
            <Col span={8}><Summary icon={<FolderOpenOutlined />} title="Folders" value={24} /></Col>
            <Col span={8}><Summary icon={<LinkOutlined />} title="Shared" value={12} /></Col>
          </Row>
          <Space direction="vertical" size={10} className={classes.fileList}>
            {files.map((file) => (
              <Flex key={file.name} align="center" gap={12} className={classes.fileRow}>
                <span className={classes.fileIcon}>{file.icon}</span>
                <div className={classes.minWidthZero}><Typography.Text strong ellipsis className={classes.block}>{file.name}</Typography.Text><Typography.Text type="secondary" className={classes.smallText}>{file.detail}</Typography.Text></div>
              </Flex>
            ))}
          </Space>
        </div>
      </Card>
    </div>
  );
}

function Summary({ icon, title, value }: { icon: React.ReactNode; title: string; value: string | number }) {
  return <Card size="small" className={classes.fullHeight}><span className={classes.primaryText}>{icon}</span><Statistic title={title} value={value} valueStyle={{ fontSize: 17, fontWeight: 650 }} /></Card>;
}

export default HomePage;
