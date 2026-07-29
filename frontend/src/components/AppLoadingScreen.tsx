import { FolderClosed } from "lucide-react";

export function AppLoadingScreen() {
  return (
    <div className="flex h-dvh items-center justify-center bg-background">
      <div className="flex flex-col items-center text-center">
        <div className="flex size-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <FolderClosed className="size-8" />
        </div>

        <h1 className="mt-4 text-lg font-semibold">File Central</h1>

        <p className="mt-1 text-sm text-muted-foreground">Loading your workspace...</p>

        <div className="mt-5 h-1 w-40 overflow-hidden rounded-full bg-muted">
          <div className="h-full w-1/2 animate-[loading_1s_ease-in-out_infinite] rounded-full bg-primary" />
        </div>
      </div>
    </div>
  );
}
