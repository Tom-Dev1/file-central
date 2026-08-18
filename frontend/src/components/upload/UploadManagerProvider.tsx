import { useCallback, useMemo, useRef, useState, type PropsWithChildren } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { uploadFolder } from "@/apis/folder-upload";
import {
  createUploadDriveFileState,
  uploadDriveFile,
  type UploadDriveFileProgress,
  type UploadDriveFileState,
} from "@/apis/upload-drive-file";
import {
  UploadManagerContext,
  type UploadManagerContextValue,
  type UploadTask,
} from "@/contexts/upload-manager.context";
import { formatFileSize } from "@/constants/file-constants";
import { driveKeys } from "@/lib/query-keys";
import { getErrorMessage, getRootFolderName } from "@/utils/upload-utils";
import { UploadProgressPanel } from "./UploadProgressPanel";

type UploadSource =
  | { kind: "file"; file: File; parentId?: string | null; uploadState: UploadDriveFileState }
  | { kind: "folder"; files: File[]; parentId?: string | null; concurrency: number };

function clampPercent(value: number) {
  return Math.min(Math.max(Math.round(value), 0), 100);
}

function getFileDetail(progress: UploadDriveFileProgress) {
  if (progress.phase === "initializing") return "Preparing upload...";
  if (progress.phase === "completing") return "Finishing upload...";
  return `${formatFileSize(progress.uploadedBytes)} of ${formatFileSize(progress.totalBytes)}`;
}

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === "AbortError";
}

export function UploadManagerProvider({ children }: PropsWithChildren) {
  const [tasks, setTasks] = useState<UploadTask[]>([]);
  const controllersRef = useRef(new Map<string, AbortController>());
  const sourcesRef = useRef(new Map<string, UploadSource>());
  const queryClient = useQueryClient();

  const updateTask = useCallback((taskId: string, patch: Partial<UploadTask>) => {
    setTasks((current) => current.map((task) => (task.id === taskId ? { ...task, ...patch } : task)));
  }, []);

  const execute = useCallback(
    (taskId: string, source: UploadSource) => {
      const controller = new AbortController();
      controllersRef.current.set(taskId, controller);
      updateTask(taskId, { status: "uploading", percent: 0, detail: "Preparing upload..." });

      const run = async () => {
        try {
          if (source.kind === "file") {
            await uploadDriveFile({
              file: source.file,
              parentId: source.parentId,
              signal: controller.signal,
              state: source.uploadState,
              onProgress: (progress) => {
                updateTask(taskId, {
                  percent: clampPercent(progress.percent),
                  detail: getFileDetail(progress),
                });
              },
            });

            updateTask(taskId, { status: "completed", percent: 100, detail: "Upload complete" });
          } else {
            const result = await uploadFolder({
              files: source.files,
              parentId: source.parentId,
              concurrency: source.concurrency,
              signal: controller.signal,
              onProgress: (progress) => {
                const detail =
                  progress.phase === "creating-folders"
                    ? "Creating folder structure..."
                    : progress.phase === "done"
                      ? "Finishing upload..."
                      : `${progress.completedFiles + progress.failedFiles} of ${progress.totalFiles} files · ${formatFileSize(progress.uploadedBytes)} of ${formatFileSize(progress.totalBytes)}`;

                updateTask(taskId, { percent: clampPercent(progress.percent), detail });
              },
            });

            if (result.failures.length > 0) {
              updateTask(taskId, {
                status: "error",
                percent: 100,
                detail: `${result.uploadedFiles.length} uploaded · ${result.failures.length} failed`,
              });
            } else {
              updateTask(taskId, {
                status: "completed",
                percent: 100,
                detail: `${result.uploadedFiles.length} files uploaded`,
              });
            }
          }
        } catch (error) {
          if (controller.signal.aborted || isAbortError(error)) {
            updateTask(taskId, { status: "cancelled", detail: "Upload cancelled" });
          } else {
            updateTask(taskId, { status: "error", detail: getErrorMessage(error) });
          }
        } finally {
          await queryClient.invalidateQueries({ queryKey: driveKeys.all });
          controllersRef.current.delete(taskId);
        }
      };

      void run();
    },
    [queryClient, updateTask]
  );

  const startFiles = useCallback(
    (selectedFiles: FileList | File[], parentId?: string | null) => {
      const pending = Array.from(selectedFiles).map((file) => {
        const id = crypto.randomUUID();
        const source: UploadSource = {
          kind: "file",
          file,
          parentId,
          uploadState: createUploadDriveFileState(),
        };
        const task: UploadTask = {
          id,
          name: file.name,
          kind: "file",
          status: "queued",
          percent: 0,
          detail: formatFileSize(file.size),
        };
        return { task, source };
      });

      for (const item of pending) sourcesRef.current.set(item.task.id, item.source);
      setTasks((current) => [...current, ...pending.map((item) => item.task)]);
      for (const item of pending) execute(item.task.id, item.source);
    },
    [execute]
  );

  const startFolder = useCallback(
    (selectedFiles: FileList | File[], parentId?: string | null, concurrency = 3) => {
      const files = Array.from(selectedFiles);
      if (files.length === 0) return;

      const id = crypto.randomUUID();
      const name = getRootFolderName(files);
      const source: UploadSource = { kind: "folder", files, parentId, concurrency };
      const task: UploadTask = {
        id,
        name,
        kind: "folder",
        status: "queued",
        percent: 0,
        detail: `${files.length} files selected`,
      };

      sourcesRef.current.set(id, source);
      setTasks((current) => [...current, task]);
      execute(id, source);
    },
    [execute]
  );

  const cancel = useCallback(
    (taskId: string) => {
      const controller = controllersRef.current.get(taskId);
      if (!controller) return;
      updateTask(taskId, { detail: "Cancelling upload..." });
      controller.abort();
    },
    [updateTask]
  );

  const retry = useCallback(
    (taskId: string) => {
      if (controllersRef.current.has(taskId)) return;
      const source = sourcesRef.current.get(taskId);
      if (source) execute(taskId, source);
    },
    [execute]
  );

  const dismiss = useCallback((taskId: string) => {
    if (controllersRef.current.has(taskId)) return;
    sourcesRef.current.delete(taskId);
    setTasks((current) => current.filter((task) => task.id !== taskId));
  }, []);

  const clearFinished = useCallback(() => {
    setTasks((current) => {
      const activeIds = new Set(controllersRef.current.keys());
      for (const task of current) {
        if (!activeIds.has(task.id)) sourcesRef.current.delete(task.id);
      }
      return current.filter((task) => activeIds.has(task.id));
    });
  }, []);

  const value = useMemo<UploadManagerContextValue>(
    () => ({ tasks, startFiles, startFolder, cancel, retry, dismiss, clearFinished }),
    [cancel, clearFinished, dismiss, retry, startFiles, startFolder, tasks]
  );

  return (
    <UploadManagerContext.Provider value={value}>
      {children}
      <UploadProgressPanel />
    </UploadManagerContext.Provider>
  );
}
