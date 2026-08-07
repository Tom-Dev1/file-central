import { Progress, Typography } from "antd";

interface UploadNotificationContentProps {
  percent: number;
  detail: string;
  status?: "normal" | "active" | "success" | "exception";
}

export function UploadNotificationContent({ percent, detail, status = "active" }: UploadNotificationContentProps) {
  return (
    <div className="min-w-0">
      <Typography.Text type="secondary" ellipsis={{ tooltip: detail }} className="block !text-xs">
        {detail}
      </Typography.Text>
      <Progress percent={percent} status={status} size="small" className="!mb-0 !mt-1" />
    </div>
  );
}
