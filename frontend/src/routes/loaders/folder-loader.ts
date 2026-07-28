import type { LoaderFunctionArgs } from "react-router-dom";
import { driveListQueryOptions } from "@/hooks/queries/drive-query-options";
import { folderBreadcrumbQueryOptions } from "@/hooks/queries/folder-query-options";
import { queryClient } from "@/lib/query-client";

export async function folderLoader({ params }: LoaderFunctionArgs) {
  const folderId = params.folderId;

  if (!folderId) {
    throw new Response("Folder ID is required.", {
      status: 400,
    });
  }
  await Promise.all([
    queryClient.ensureQueryData(
      driveListQueryOptions({
        parentId: folderId,
        page: 1,
        limit: 100,
      })
    ),

    queryClient.ensureQueryData(folderBreadcrumbQueryOptions(folderId)),
  ]);

  return null;
}
