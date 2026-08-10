import { Progress, Typography } from "antd";
import classes from "./UploadNotificationContent.module.css";


interface UploadNotificationContentProps {
  percent: number;
  detail: string;
  status?: "normal" | "active" | "success" | "exception";
}

export function UploadNotificationContent({ percent, detail, status = "active" }: UploadNotificationContentProps) {
  return (
    <div className={classes.div}>
      <Typography.Text type="secondary" ellipsis={{ tooltip: detail }} className={classes.text}>
        {detail}
      </Typography.Text>
      <Progress percent={percent} status={status} size="small" className={classes.progress} />
    </div>
  );
}
