import { Button, Result } from "antd";
import classes from "./FolderErrorState.module.css";


interface FolderErrorStateProps {
  title: string;
  description: string;
  retryLabel: string;
  onRetry: () => void;
}

export default function FolderErrorState({ title, description, retryLabel, onRetry }: FolderErrorStateProps) {
  return (
    <div className={classes.centeredRow}>
      <Result
        status="error"
        title={title}
        subTitle={description}
        extra={<Button type="primary" onClick={onRetry}>{retryLabel}</Button>}
      />
    </div>
  );
}
