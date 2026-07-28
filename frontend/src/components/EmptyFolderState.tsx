import { Folder } from "lucide-react";
import { UploadFileButton } from "./UploadFileButton";
import { UploadFolderButton } from "./UploadFoldersButton";
import { CreateFolderButton } from "./CreateFolder";

interface EmptyFolderStateProps {
  parentId?: string | null;
  className?: string;
}

export default function EmptyFolderState({ parentId, className }: EmptyFolderStateProps) {
  return (
    <div className={`flex min-h-[400px] flex-col items-center justify-center px-4 text-center ${className ?? ""}`}>
      <div className="flex size-20 items-center justify-center rounded-3xl bg-muted/70">
        <Folder className="size-10 text-muted-foreground" />
      </div>

      <h3 className="mt-5 text-base font-semibold">This folder is empty</h3>

      <p className="mt-1 max-w-sm text-sm leading-6 text-muted-foreground">
        Upload files or create a new folder to organize your content.
      </p>

      <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
        <CreateFolderButton
          parentId={parentId}
          className="h-10 w-auto rounded-md border bg-muted px-4 hover:bg-accent"
        />

        <UploadFileButton
          parentId={parentId}
          className="h-10 w-auto rounded-md border bg-muted px-4 hover:bg-accent "
        />

        <UploadFolderButton
          parentId={parentId}
          className="h-10 w-auto rounded-md border bg-muted px-4 hover:bg-accent"
        />
      </div>
    </div>
  );
}
