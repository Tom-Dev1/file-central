import { Spin, Typography } from "antd";
import { clsx as cn } from "clsx";
import classes from "./LoadingStates.module.css";


interface LoadingStateProps {
  message?: string;
  className?: string;
  fullHeight?: boolean;
}

export function LoadingState({ message = "Loading data...", className, fullHeight = false }: LoadingStateProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        classes.centeredColumn,
        fullHeight ? classes.div : classes.div2,
        className
      )}
    >
      <Spin size="large" />

      <div className={classes.div3}>
        <Typography.Text strong className={classes.text}>
          {message}
        </Typography.Text>
        <Typography.Text type="secondary" className={classes.text2}>
          Please wait while we fetch your data.
        </Typography.Text>
      </div>

      <span className={classes.visuallyHidden}>{message}</span>
    </div>
  );
}
