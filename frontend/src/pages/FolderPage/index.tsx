import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useDriveList } from "@/hooks";
import DriveGridView from "../Dashboard/MyDrive/DriveGridView";
import { DriveListView } from "../Dashboard/MyDrive/DriveListView";
import type { DriveItem } from "@/types/api.types";
import { FolderBreadcrumbs } from "@/components/FolderBreadcrumb";
import FolderErrorState from "./FolderErrorState";
import EmptyFolderState from "@/components/EmptyFolderState";
import { DrivePageShell } from "@/components/drive/DrivePageShell";
import { DriveSubHeader } from "@/components/drive/DriveSubHeader";
import { DriveViewActions } from "@/components/drive/DriveViewActions";
import { Folder } from "lucide-react";
import { usePrefetchDriveFolder } from "@/hooks/usePrefetchDriveFolder";
import { LoadingState } from "./LoadingStates";

type ViewMode = "grid" | "list";

export default function FolderPage() {
  const { folderId } = useParams<{ folderId: string }>();
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const prefetchFolder = usePrefetchDriveFolder();
  const listParams = useMemo(
    () => ({
      parentId: folderId,
      page: 1,
      limit: 100,
    }),
    [folderId]
  );
  const { data, isLoading, isFetching, isError, refetch } = useDriveList(listParams);
  const itemsDrive = useMemo(() => data?.items ?? [], [data?.items]);
  const folders = useMemo(() => itemsDrive.filter((item) => item.type === "folder"), [itemsDrive]);
  const files = useMemo(() => itemsDrive.filter((item) => item.type === "file"), [itemsDrive]);

  if (!folderId) {
    return (
      <FolderErrorState
        title="Invalid folder"
        description="The requested folder ID is missing."
        retryLabel="Return to My Drive"
        onRetry={() => navigate("/dashboard")}
      />
    );
  }
  if (isLoading) {
    return <LoadingState message="Loading..." />;
  }

  if (isError) {
    return (
      <FolderErrorState
        title="Unable to load folder"
        description="Something went wrong while loading this folder."
        retryLabel="Retry"
        onRetry={() => void refetch()}
      />
    );
  }

  const handleOpenItem = (item: DriveItem) => {
    if (item.type === "folder") {
      navigate(`/dashboard/folders/${item.id}`);
      return;
    }
    console.log("Open file", item);
  };

  return (
    <DrivePageShell
      header={
        <DriveSubHeader
          folderBreadcrumbs={<FolderBreadcrumbs folderId={folderId} />}
          title="My Drive"
          // description={`${driveItems.length} ${driveItems.length === 1 ? "item" : "items"}`}
          icon={Folder}
          actions={
            <DriveViewActions
              parentId={folderId}
              itemIds={itemsDrive.map((item) => item.id)}
              viewMode={viewMode}
              isFetching={isFetching}
              onViewModeChange={setViewMode}
              onRefresh={() => {
                void refetch();
              }}
            />
          }
        />
      }
    >
      {/* CONTENT */}
      <div className="flex-1 p-4">
        {folders.length > 0 && (
          <section>
            <h2 className="mb-3 text-sm font-semibold">Folders</h2>
            {viewMode === "grid" ? (
              <DriveGridView items={folders} onOpenItem={handleOpenItem} onPrefetchItem={prefetchFolder} />
            ) : (
              <DriveListView items={folders} onOpenItem={handleOpenItem} onPrefetchItem={prefetchFolder} />
            )}
          </section>
        )}

        {files.length > 0 && (
          <section className="mt-8">
            <h2 className="mb-3 text-sm font-semibold">Files</h2>
            {viewMode === "grid" ? (
              <DriveGridView items={files} onOpenItem={handleOpenItem} onPrefetchItem={prefetchFolder} />
            ) : (
              <DriveListView items={files} onOpenItem={handleOpenItem} onPrefetchItem={prefetchFolder} />
            )}
          </section>
        )}

        {itemsDrive.length === 0 && <EmptyFolderState parentId={folderId} />}
      </div>
    </DrivePageShell>
  );
}
