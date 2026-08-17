import { createContext } from "react";

export type UploadTaskKind = "file" | "folder";
export type UploadTaskStatus = "queued" | "uploading" | "completed" | "error" | "cancelled";

export interface UploadTask {
  id: string;
  name: string;
  kind: UploadTaskKind;
  status: UploadTaskStatus;
  percent: number;
  detail: string;
}

export interface UploadManagerContextValue {
  tasks: UploadTask[];
  startFiles: (files: FileList | File[], parentId?: string | null) => void;
  startFolder: (files: FileList | File[], parentId?: string | null, concurrency?: number) => void;
  cancel: (taskId: string) => void;
  retry: (taskId: string) => void;
  dismiss: (taskId: string) => void;
  clearFinished: () => void;
}

export const UploadManagerContext = createContext<UploadManagerContextValue | null>(null);
