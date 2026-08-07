import { LoginOutlined, UserOutlined } from "@ant-design/icons";
import { Alert, Button, Card, Checkbox, Form, Input, Space, Typography, theme } from "antd";
import { Link, useNavigate } from "react-router-dom";

import { useLogin } from "@/hooks/useAuth";
import { describeAuthError } from "./authError";

interface LoginFormValues {
  username: string;
  password: string;
  remember: boolean;
}

function LoginPage() {
  const navigate = useNavigate();
  const login = useLogin();
  const { token } = theme.useToken();

  const handleSubmit = (values: LoginFormValues) => {
    login.reset();
    login.mutate(
      {
        credentials: {
          username: values.username.trim(),
          password: values.password,
        },
        remember: values.remember,
      },
      {
        onSuccess: () => navigate("/dashboard", { replace: true }),
      }
    );
  };

  return (
    <Card
      bordered
      style={{ borderColor: token.colorBorderSecondary, boxShadow: token.boxShadowTertiary }}
      styles={{ body: { padding: "clamp(24px, 5vw, 38px)" } }}
    >
      <header style={{ textAlign: "center", marginBottom: 28 }}>
        <div
          aria-hidden="true"
          style={{
            display: "inline-flex",
            width: 48,
            height: 48,
            alignItems: "center",
            justifyContent: "center",
            borderRadius: 14,
            color: token.colorPrimary,
            background: token.colorPrimaryBg,
            fontSize: 22,
            marginBottom: 16,
          }}
        >
          <LoginOutlined />
        </div>
        <Typography.Title level={2} style={{ fontSize: 28, margin: "0 0 7px" }}>
          Welcome back
        </Typography.Title>
        <Typography.Text type="secondary">Log in to continue to your File Central workspace.</Typography.Text>
      </header>

      <Form<LoginFormValues>
        name="login"
        layout="vertical"
        size="large"
        requiredMark={false}
        disabled={login.isPending}
        initialValues={{ remember: true }}
        onFinish={handleSubmit}
      >
        {login.isError && !login.isPending && (
          <Alert
            showIcon
            closable
            type="error"
            message="Login unsuccessful"
            description={describeAuthError(login.error, "login")}
            onClose={() => login.reset()}
            style={{ marginBottom: 22 }}
          />
        )}

        <Form.Item
          label="Username"
          name="username"
          rules={[
            { required: true, whitespace: true, message: "Enter your username." },
            { min: 3, message: "Username must contain at least 3 characters." },
          ]}
        >
          <Input prefix={<UserOutlined />} placeholder="your.username" autoComplete="username" autoFocus />
        </Form.Item>

        <Form.Item
          label="Password"
          name="password"
          rules={[{ required: true, message: "Enter your password." }]}
        >
          <Input.Password prefix={<LoginOutlined />} placeholder="Enter your password" autoComplete="current-password" />
        </Form.Item>

        <Form.Item name="remember" valuePropName="checked" style={{ marginBottom: 22 }}>
          <Checkbox>Keep me signed in on this device</Checkbox>
        </Form.Item>

        <Button type="primary" htmlType="submit" block loading={login.isPending}>
          {login.isPending ? "Logging in" : "Log in"}
        </Button>
      </Form>

      <Space direction="vertical" size={10} style={{ display: "flex", marginTop: 22, textAlign: "center" }}>
        <Typography.Text type="secondary" style={{ fontSize: 13 }}>
          Need password help? Contact your workspace administrator.
        </Typography.Text>
        <Typography.Text type="secondary">
          New to File Central?{" "}
          <Link to="/auth/register" style={{ color: token.colorPrimary, fontWeight: 600 }}>
            Create an account
          </Link>
        </Typography.Text>
      </Space>
    </Card>
  );
}

export default LoginPage;
