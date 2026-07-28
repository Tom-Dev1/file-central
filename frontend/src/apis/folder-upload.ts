import { toApiError, type ApiError } from "@/lib/api-error";
import type { DriveItem } from "@/types/api.types";
import { foldersApi } from "./folders.api";
import { driveApi } from "./drive.api";
import { filesApi } from "./files.api";

export interface UploadFolderProgress {
  totalFiles: number;
  completedFiles: number;
  failedFiles: number;
  // 0-100, based on (completed + failed) / total.
  percent: number;
  currentFileName?: string;
  phase: "creating-folders" | "uploading-files" | "done";
}
export interface UploadFolderFailure {
  relativePath: string;
  error: ApiError;
}

export interface UploadFolderResult {
  createdFolders: DriveItem[];
  uploadedFiles: DriveItem[];
  // Files that failed - the rest of the batch still completes
  failures: UploadFolderFailure[];
}
export interface UploadFolderOptions {
  //FileList from <input webkitdirectory multiple>, or an equivalent array from drag-and-drop. /
  files: FileList | File[];
  // Where the picked folder gets created. Omit/null = drive root. /
  parentId?: string | null;
  onProgress?: (progress: UploadFolderProgress) => void;
  // Simultaneous file uploads.
  concurrency?: number;
  signal?: AbortSignal;
}
function getDirPath(relativePath: string): string {
  const idx = relativePath.lastIndexOf("/");
  return idx === -1 ? "" : relativePath.slice(0, idx);
}

function getParentPath(dirPath: string): string {
  const idx = dirPath.lastIndexOf("/");
  return idx === -1 ? "" : dirPath.slice(0, idx);
}

function getSegmentName(dirPath: string): string {
  const idx = dirPath.lastIndexOf("/");
  return idx === -1 ? dirPath : dirPath.slice(idx + 1);
}
async function ensureFolder(name: string, parentId: string | null): Promise<DriveItem> {
  try {
    return await foldersApi.create({ name, parentId });
  } catch (error) {
    const apiError = toApiError(error);
    if (!apiError.isConflict) throw apiError;

    const existing = await driveApi.list({
      parentId: parentId ?? undefined,
      type: "folder",
      limit: 200,
    });
    const match = existing.items.find((item) => item.name === name);
    if (match) return match;
    throw apiError; // name conflict but couldn't find it
  }
}

// Runs async tasks with at most `limit` running concurrently.
async function runWithConcurrency(tasks: Array<() => Promise<void>>, limit: number): Promise<void> {
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < tasks.length) {
      const task = tasks[nextIndex++];
      await task();
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, tasks.length) }, worker));
}

export async function uploadFolder({
  files,
  parentId = null,
  onProgress,
  concurrency = 3,
  signal,
}: UploadFolderOptions): Promise<UploadFolderResult> {
  const fileArray = Array.from(files);
  const totalFiles = fileArray.length;

  let completedFiles = 0;
  let failedFiles = 0;
  const report = (phase: UploadFolderProgress["phase"], currentFileName?: string) => {
    onProgress?.({
      totalFiles,
      completedFiles,
      failedFiles,
      percent: totalFiles === 0 ? 100 : Math.round(((completedFiles + failedFiles) / totalFiles) * 100),
      currentFileName,
      phase,
    });
  };

  // 1: figure out every directory that needs to exist
  // The browser only tells us about FILES, never empty folders
  // webkitdirectory API
  const dirPaths = new Set<string>();
  for (const file of fileArray) {
    const relativePath = file.webkitRelativePath || file.name;
    let path = getDirPath(relativePath);
    while (path) {
      dirPaths.add(path);
      path = getParentPath(path);
    }
  }

  //parent always exists before create its child.
  const sortedDirPaths = Array.from(dirPaths).sort((a, b) => a.split("/").length - b.split("/").length);

  // 2: create folders top-down
  report("creating-folders");
  const pathToFolderId = new Map<string, string | null>([["", parentId]]);
  const createdFolders: DriveItem[] = [];

  for (const dirPath of sortedDirPaths) {
    if (signal?.aborted) throw new DOMException("Upload cancelled", "AbortError");

    const parentFolderId = pathToFolderId.get(getParentPath(dirPath)) ?? null;
    const folder = await ensureFolder(getSegmentName(dirPath), parentFolderId);
    pathToFolderId.set(dirPath, folder.id);
    createdFolders.push(folder);
  }

  // Phase 3: upload files, several at a time
  report("uploading-files");
  const uploadedFiles: DriveItem[] = [];
  const failures: UploadFolderFailure[] = [];

  const tasks = fileArray.map((file) => async () => {
    if (signal?.aborted) return; // let already-queued work drain instead of throwing mid-batch

    const relativePath = file.webkitRelativePath || file.name;
    const targetParentId = pathToFolderId.get(getDirPath(relativePath)) ?? parentId;

    report("uploading-files", relativePath);
    try {
      const uploaded = await filesApi.upload({ file, parentId: targetParentId, signal });
      uploadedFiles.push(uploaded);
      completedFiles++;
    } catch (error) {
      failedFiles++;
      failures.push({ relativePath, error: toApiError(error) });
    }
    report("uploading-files", relativePath);
  });

  await runWithConcurrency(tasks, concurrency);

  report("done");
  return { createdFolders, uploadedFiles, failures };
}
