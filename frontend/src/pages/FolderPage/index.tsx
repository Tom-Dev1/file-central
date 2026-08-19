import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { App, Button } from "antd";
import { useInfiniteDriveList } from "@/hooks";
import DriveGridView from "../Dashboard/MyDrive/DriveGridView";
import { DriveListView } from "@/components/drive/list";
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
import { DriveToolbar } from "@/components/drive/toolbar/DriveToolBar";
import type { DriveSortState } from "@/types/drive.type";
import { DrivePreviewLayout } from "@/components/drive/DrivePreviewLayout";
import { useDriveSelection } from "@/contexts/driveSelectionContext";
import { useDrivePreviewPane } from "@/hooks/useDrivePreviewPane";
import { useDriveViewMode } from "@/hooks/useDriveViewMode";
import { DriveContentSkeleton } from "@/components/DriveContentSkeleton";
import { createDriveSortSearch, readDriveSortParams, writeDriveSortParams } from "@/utils/drive-sort-params";

export default function FolderPage() {
  const { folderId } = useParams<{ folderId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { message } = App.useApp();
  const [isManualRefreshing, setIsManualRefreshing] = useState(false);
  const searchParams = new URLSearchParams(location.search);
  const sort = readDriveSortParams(searchParams);
  const sortSearch = createDriveSortSearch(sort);
  const prefetchFolder = usePrefetchDriveFolder();
  const { selectedIds, clearSelection } = useDriveSelection();
  const { previewPaneOpen, setPreviewPaneOpen } = useDrivePreviewPane();
  const { viewMode, setViewMode } = useDriveViewMode();
  const listParams = useMemo(
    () => ({
      parentId: folderId,
      limit: 100,
      sort: sort.field,
      direction: sort.direction,
    }),
    [folderId, sort.direction, sort.field]
  );
  const {
    data,
    isLoading,
    isError,
    isFetching,
    isPlaceholderData,
    refetch,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
  } = useInfiniteDriveList(listParams);
  const itemsDrive = useMemo(() => data?.pages.flatMap((page) => page.items) ?? [], [data?.pages]);
  const selectedItems = itemsDrive.filter((item) => selectedIds.has(item.id));
  const selectedItem = selectedItems.length === 1 ? selectedItems[0] : null;
  const isSortTransitioning = isPlaceholderData && isFetching;
  const showContentSkeleton = isManualRefreshing || isSortTransitioning;

  useEffect(() => {
    clearSelection();
  }, [clearSelection, folderId]);

  useEffect(() => {
    const currentParams = new URLSearchParams(location.search);

    if (currentParams.get("sort") === sort.field && currentParams.get("direction") === sort.direction) return;

    const nextParams = writeDriveSortParams(currentParams, {
      field: sort.field,
      direction: sort.direction,
    });

    navigate(
      {
        pathname: location.pathname,
        search: `?${nextParams.toString()}`,
        hash: location.hash,
      },
      { replace: true }
    );
  }, [location.hash, location.pathname, location.search, navigate, sort.direction, sort.field]);

  if (!folderId) {
    return (
      <FolderErrorState
        title="Invalid folder"
        description="The requested folder ID is missing."
        retryLabel="Return to My Drive"
        onRetry={() => navigate(`/dashboard?${sortSearch}`)}
      />
    );
  }
  if (isLoading) {
    return <LoadingState message="Loading..." />;
  }

  if (isError && !data) {
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
      clearSelection();
      navigate(`/dashboard/folders/${item.id}?${sortSearch}`);
      return;
    }
  };

  const handleRefresh = async () => {
    setIsManualRefreshing(true);

    try {
      const result = await refetch();

      if (result.isError) {
        void message.error("Unable to refresh this folder. The current list has been kept.");
      }
    } finally {
      setIsManualRefreshing(false);
    }
  };

  const handleSortChange = (nextSort: DriveSortState) => {
    const nextParams = writeDriveSortParams(new URLSearchParams(location.search), nextSort);

    navigate(
      {
        pathname: location.pathname,
        search: `?${nextParams.toString()}`,
        hash: location.hash,
      },
      { replace: true }
    );
  };

  return (
    <DrivePreviewLayout
      open={previewPaneOpen}
      item={selectedItem}
      selectedCount={selectedItems.length}
      onClose={() => setPreviewPaneOpen(false)}
    >
      <DrivePageShell
        header={
          <DriveSubHeader
            folderBreadcrumbs={<FolderBreadcrumbs folderId={folderId} />}
            title="My Drive"
            description={`${itemsDrive.length} ${itemsDrive.length === 1 ? "item" : "items"} loaded · ${
              hasNextPage ? "more available" : "all loaded"
            }`}
            icon={Folder}
            titleHref={`/dashboard?${sortSearch}`}
            actions={
              <DriveViewModeToggle
                value={viewMode}
                onChange={setViewMode}
                previewOpen={previewPaneOpen}
                onPreviewOpenChange={setPreviewPaneOpen}
              />
            }
          />
        }
      >
        <div className={classes.div}>
          <DriveToolbar
            parentId={folderId}
            items={itemsDrive}
            sort={sort}
            isFetching={isManualRefreshing}
            onSortChange={handleSortChange}
            onRefresh={() => void handleRefresh()}
          />

          <div className={classes.view}>
            {showContentSkeleton ? (
              <DriveContentSkeleton viewMode={viewMode} />
            ) : itemsDrive.length > 0 ? (
              (viewMode === "grid" ? (
                <DriveGridView
                  items={itemsDrive}
                  previewPaneOpen={previewPaneOpen}
                  onOpenItem={handleOpenItem}
                  onPrefetchItem={prefetchFolder}
                />
              ) : (
                <DriveListView
                  items={itemsDrive}
                  sort={sort}
                  onSortChange={handleSortChange}
                  onOpenItem={handleOpenItem}
                  onPrefetchItem={prefetchFolder}
                />
              ))
            ) : (
              <EmptyFolderState parentId={folderId} />
            )}
          </div>

          {hasNextPage && !showContentSkeleton && (
            <div className={classes.centeredRow}>
              <Button loading={isFetchingNextPage} onClick={() => void fetchNextPage()}>
                Load more
              </Button>
            </div>
          )}
        </div>
      </DrivePageShell>
    </DrivePreviewLayout>
  );
}
