import { Button } from "@/components/ui/button";
import { AlertCircle } from "lucide-react";

interface FolderErrorStateProps {
  title: string;
  description: string;
  retryLabel: string;
  onRetry: () => void;
}

export default function FolderErrorState({ title, description, retryLabel, onRetry }: FolderErrorStateProps) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
      <AlertCircle className="size-10 text-destructive" />

      <h1 className="mt-4 text-xl font-semibold">{title}</h1>

      <p className="mt-2 text-sm text-muted-foreground">{description}</p>

      <Button className="mt-6" onClick={onRetry}>
        {retryLabel}
      </Button>
    </div>
  );
}
