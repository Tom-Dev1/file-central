import { LockOutlined, MailOutlined, UserAddOutlined, UserOutlined } from "@ant-design/icons";
import { Alert, Button, Card, Checkbox, Form, Input, Typography, theme } from "antd";
import { Link, useNavigate } from "react-router-dom";

import { useRegister } from "@/hooks/useAuth";
import { describeAuthError } from "./authError";

interface RegisterFormValues {
  name: string;
  username: string;
  email: string;
  password: string;
  confirmPassword: string;
  acceptedTerms: boolean;
}

function RegisterPage() {
  const navigate = useNavigate();
  const register = useRegister();
  const { token } = theme.useToken();

  const handleSubmit = (values: RegisterFormValues) => {
    register.reset();
    register.mutate(
      {
        name: values.name.trim(),
        username: values.username.trim(),
        email: values.email.trim().toLowerCase(),
        password: values.password,
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
      styles={{ body: { padding: "clamp(24px, 5vw, 36px)" } }}
    >
      <header style={{ textAlign: "center", marginBottom: 24 }}>
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
            marginBottom: 14,
          }}
        >
          <UserAddOutlined />
        </div>
        <Typography.Title level={2} style={{ fontSize: 28, margin: "0 0 6px" }}>
          Create your account
        </Typography.Title>
        <Typography.Text type="secondary">Start organizing and sharing your files securely.</Typography.Text>
      </header>

      <Form<RegisterFormValues>
        name="register"
        layout="vertical"
        size="large"
        requiredMark={false}
        disabled={register.isPending}
        onFinish={handleSubmit}
      >
        {register.isError && !register.isPending && (
          <Alert
            showIcon
            closable
            type="error"
            message="Account creation unsuccessful"
            description={describeAuthError(register.error, "register")}
            onClose={() => register.reset()}
            style={{ marginBottom: 20 }}
          />
        )}

        <Form.Item
          label="Full name"
          name="name"
          rules={[
            { required: true, whitespace: true, message: "Enter your full name." },
            { min: 2, message: "Name must contain at least 2 characters." },
            { max: 100, message: "Name cannot exceed 100 characters." },
          ]}
        >
          <Input prefix={<UserOutlined />} placeholder="Alex Morgan" autoComplete="name" autoFocus />
        </Form.Item>

        <Form.Item
          label="Username"
          name="username"
          extra="Use letters, numbers, dots, underscores, or hyphens."
          rules={[
            { required: true, whitespace: true, message: "Choose a username." },
            { min: 3, message: "Username must contain at least 3 characters." },
            { pattern: /^[a-zA-Z0-9._-]+$/, message: "Username contains unsupported characters." },
          ]}
        >
          <Input prefix={<UserOutlined />} placeholder="alex.morgan" autoComplete="username" />
        </Form.Item>

        <Form.Item
          label="Email"
          name="email"
          rules={[
            { required: true, whitespace: true, message: "Enter your email address." },
            { type: "email", message: "Enter a valid email address." },
          ]}
        >
          <Input prefix={<MailOutlined />} placeholder="alex@example.com" autoComplete="email" />
        </Form.Item>

        <Form.Item
          label="Password"
          name="password"
          rules={[
            { required: true, message: "Create a password." },
            { min: 8, message: "Password must contain at least 8 characters." },
          ]}
        >
          <Input.Password prefix={<LockOutlined />} placeholder="At least 8 characters" autoComplete="new-password" />
        </Form.Item>

        <Form.Item
          label="Confirm password"
          name="confirmPassword"
          dependencies={["password"]}
          rules={[
            { required: true, message: "Confirm your password." },
            ({ getFieldValue }) => ({
              validator(_, value: string | undefined) {
                if (!value || getFieldValue("password") === value) return Promise.resolve();
                return Promise.reject(new Error("The passwords do not match."));
              },
            }),
          ]}
        >
          <Input.Password prefix={<LockOutlined />} placeholder="Enter the password again" autoComplete="new-password" />
        </Form.Item>

        <Form.Item
          name="acceptedTerms"
          valuePropName="checked"
          rules={[
            {
              validator: (_, accepted: boolean | undefined) =>
                accepted ? Promise.resolve() : Promise.reject(new Error("You must accept the terms to continue.")),
            },
          ]}
          style={{ marginBottom: 22 }}
        >
          <Checkbox>
            I agree to File Central&apos;s Terms of Service and Privacy Policy.
          </Checkbox>
        </Form.Item>

        <Button type="primary" htmlType="submit" block loading={register.isPending}>
          {register.isPending ? "Creating account" : "Create account"}
        </Button>
      </Form>

      <Typography.Paragraph type="secondary" style={{ margin: "22px 0 0", textAlign: "center" }}>
        Already have an account?{" "}
        <Link to="/auth/login" style={{ color: token.colorPrimary, fontWeight: 600 }}>
          Log in
        </Link>
      </Typography.Paragraph>
    </Card>
  );
}

export default RegisterPage;
