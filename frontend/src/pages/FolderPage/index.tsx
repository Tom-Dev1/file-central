import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "antd";
import { useInfiniteDriveList } from "@/hooks";
import DriveGridView from "../Dashboard/MyDrive/DriveGridView";
import { DriveListView } from "../Dashboard/MyDrive/DriveListView";
import type { DriveItem } from "@/types/api.types";
import { FolderBreadcrumbs } from "@/components/FolderBreadcrumb";
import FolderErrorState from "./FolderErrorState";
import EmptyFolderState from "@/components/EmptyFolderState";
import { DrivePageShell } from "@/components/drive/DrivePageShell";
import { DriveSubHeader } from "@/components/drive/DriveSubHeader";
import { Folder } from "lucide-react";
import { usePrefetchDriveFolder } from "@/hooks/usePrefetchDriveFolder";
import { LoadingState } from "./LoadingStates";
import classes from "./index.module.css";
import { DriveViewModeToggle } from "@/components/drive/DriveViewModeToggle";

type ViewMode = "grid" | "list";

export default function FolderPage() {
  const { folderId } = useParams<{ folderId: string }>();
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const prefetchFolder = usePrefetchDriveFolder();
  const listParams = useMemo(
    () => ({
      parentId: folderId,
      limit: 100,
    }),
    [folderId]
  );
  const { data, isLoading, isError, refetch, hasNextPage, fetchNextPage, isFetchingNextPage } =
    useInfiniteDriveList(listParams);
  const itemsDrive = useMemo(() => data?.pages.flatMap((page) => page.items) ?? [], [data?.pages]);
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
  };

  return (
    <DrivePageShell
      header={
        <DriveSubHeader
          folderBreadcrumbs={<FolderBreadcrumbs folderId={folderId} />}
          title="My Drive"
          description={`${itemsDrive.length} ${itemsDrive.length === 1 ? "item" : "items"} loaded · ${
            hasNextPage ? "more available" : "all loaded"
          }`}
          icon={Folder}
          actions={<DriveViewModeToggle value={viewMode} onChange={setViewMode} />}
        />
      }
    >
      {/* CONTENT */}
      <div className={classes.div}>
        {folders.length > 0 && (
          <section>
            <h2 className={classes.title}>Folders</h2>
            {viewMode === "grid" ? (
              <DriveGridView items={folders} onOpenItem={handleOpenItem} onPrefetchItem={prefetchFolder} />
            ) : (
              <DriveListView items={folders} onOpenItem={handleOpenItem} onPrefetchItem={prefetchFolder} />
            )}
          </section>
        )}

        {files.length > 0 && (
          <section className={classes.section}>
            <h2 className={classes.title}>Files</h2>
            {viewMode === "grid" ? (
              <DriveGridView items={files} onOpenItem={handleOpenItem} onPrefetchItem={prefetchFolder} />
            ) : (
              <DriveListView items={files} onOpenItem={handleOpenItem} onPrefetchItem={prefetchFolder} />
            )}
          </section>
        )}

        {itemsDrive.length === 0 && <EmptyFolderState parentId={folderId} />}

        {hasNextPage && (
          <div className={classes.centeredRow}>
            <Button loading={isFetchingNextPage} onClick={() => void fetchNextPage()}>
              Load more
            </Button>
          </div>
        )}
      </div>
    </DrivePageShell>
  );
}
