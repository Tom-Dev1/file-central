import { Button, Result } from "antd";

interface FolderErrorStateProps {
  title: string;
  description: string;
  retryLabel: string;
  onRetry: () => void;
}

export default function FolderErrorState({ title, description, retryLabel, onRetry }: FolderErrorStateProps) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6 text-center">
      <Result
        status="error"
        title={title}
        subTitle={description}
        extra={<Button type="primary" onClick={onRetry}>{retryLabel}</Button>}
      />
    </div>
  );
}
