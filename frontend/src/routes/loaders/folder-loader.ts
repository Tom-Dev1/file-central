import type { LoaderFunctionArgs } from "react-router-dom";

export function folderLoader({ params }: LoaderFunctionArgs) {
  const folderId = params.folderId;

  if (!folderId) {
    throw new Response("Folder ID is required.", {
      status: 400,
    });
  }
  return null;
}
