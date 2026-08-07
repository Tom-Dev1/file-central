import { CheckOutlined } from "@ant-design/icons";
import { Button, Dropdown, Tooltip, type MenuProps } from "antd";
import { Laptop, Moon, Sun } from "lucide-react";

import { useTheme } from "@/contexts/themeContext";

const themes = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Laptop },
] as const;

export function ModeToggle() {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const ActiveIcon = resolvedTheme === "dark" ? Moon : Sun;

  const items: MenuProps["items"] = themes.map((item) => {
    const Icon = item.icon;
    const isSelected = theme === item.value;

    return {
      key: item.value,
      icon: <Icon className="size-4" />,
      label: item.label,
      extra: isSelected ? <CheckOutlined aria-label="Selected" /> : undefined,
      onClick: () => setTheme(item.value),
    };
  });

  return (
    <Dropdown
      menu={{ items, selectedKeys: [theme] }}
      placement="bottomRight"
      trigger={["click"]}
    >
      <Tooltip title="Appearance">
        <Button
          type="text"
          shape="circle"
          size="large"
          aria-label={`Change theme. Current setting: ${theme}`}
          icon={<ActiveIcon className="size-5" />}
        />
      </Tooltip>
    </Dropdown>
  );
}
