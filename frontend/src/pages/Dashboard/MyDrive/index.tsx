import { Folder, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { App, Button, Result } from "antd";
import { useLocation, useNavigate } from "react-router-dom";
import DriveGridView from "./DriveGridView";
import { DriveListView } from "@/components/drive/list";
import { DrivePageShell } from "@/components/drive/DrivePageShell";
import { DriveSubHeader } from "@/components/drive/DriveSubHeader";
import { DriveToolbar } from "@/components/drive/toolbar/DriveToolBar";
import { DriveViewModeToggle } from "@/components/drive/DriveViewModeToggle";
import { DrivePreviewLayout } from "@/components/drive/DrivePreviewLayout";
import { DriveContentSkeleton } from "@/components/DriveContentSkeleton";
import { useDriveSelection } from "@/contexts/driveSelectionContext";
import { useDrivePreviewPane } from "@/hooks/useDrivePreviewPane";
import { useInfiniteDriveList, useInfiniteDriveSearch } from "@/hooks";
import { usePrefetchDriveFolder } from "@/hooks/usePrefetchDriveFolder";
import { LoadingState } from "@/pages/FolderPage/LoadingStates";
import type { DriveItem } from "@/types/api.types";
import type { DriveSortState, DriveViewMode } from "@/types/drive.type";
import { createDriveSortSearch, readDriveSortParams, writeDriveSortParams } from "@/utils/drive-sort-params";
import classes from "./index.module.css";
export default function MyDrivePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { message } = App.useApp();

  const prefetchFolder = usePrefetchDriveFolder();
  const { selectedIds, clearSelection } = useDriveSelection();
  const { previewPaneOpen, setPreviewPaneOpen } = useDrivePreviewPane();

  const [viewMode, setViewMode] = useState<DriveViewMode>("list");
  const [isManualRefreshing, setIsManualRefreshing] = useState(false);

  const searchParams = new URLSearchParams(location.search);
  const query = (searchParams.get("q") ?? "").trim();
  const sort = readDriveSortParams(searchParams);
  const sortSearch = createDriveSortSearch(sort);

  const isSearchMode = query.length > 0;

  useEffect(() => {
    clearSelection();
  }, [clearSelection, query]);

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

  const listQuery = useInfiniteDriveList({
    limit: 100,
    sort: sort.field,
    direction: sort.direction,
  });

  const searchQuery = useInfiniteDriveSearch({
    q: query,
    limit: 100,
  });

  const activeQuery = isSearchMode ? searchQuery : listQuery;

  const {
    data,
    isLoading,
    isError,
    isFetching,
    isPlaceholderData,
    hasNextPage,
    isFetchingNextPage,
    refetch,
    fetchNextPage,
  } = activeQuery;

  const driveItems = data?.pages.flatMap((page) => page.items) ?? [];
  const selectedItems = driveItems.filter((item) => selectedIds.has(item.id));
  const selectedItem = selectedItems.length === 1 ? selectedItems[0] : null;
  const isSortTransitioning = !isSearchMode && isPlaceholderData && isFetching;
  const showContentSkeleton = isManualRefreshing || isSortTransitioning;

  if (isLoading) {
    return <LoadingState message={isSearchMode ? `Searching for "${query}"...` : "Loading files..."} />;
  }

  if (isError && !data) {
    return (
      <Result
        status="error"
        title={isSearchMode ? "Unable to search Drive" : "Unable to load files"}
        subTitle="Something went wrong while fetching your files. Please try again."
        extra={
          <Button color="primary" variant="solid" onClick={() => void refetch()}>
            Try again
          </Button>
        }
      />
    );
  }

  const handleOpenItem = (item: DriveItem) => {
    if (item.type !== "folder") {
      return;
    }

    clearSelection();
    navigate(`/dashboard/folders/${item.id}?${sortSearch}`);
  };

  const handleRefresh = async () => {
    setIsManualRefreshing(true);

    try {
      const result = await refetch();

      if (result.isError) {
        void message.error("Unable to refresh Drive. The current list has been kept.");
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

  const headerDescription = isSearchMode
    ? `${driveItems.length} ${driveItems.length === 1 ? "result" : "results"} for "${query}"`
    : `${driveItems.length} ${driveItems.length === 1 ? "item" : "items"}`;

  return (
    <DrivePageShell
      header={
        <DriveSubHeader
          title={isSearchMode ? "Search results" : "My Drive"}
          description={headerDescription}
          icon={isSearchMode ? Search : Folder}
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
      <DrivePreviewLayout
        open={previewPaneOpen}
        item={selectedItem}
        selectedCount={selectedItems.length}
        onClose={() => setPreviewPaneOpen(false)}
      >
        <div className={classes.browser}>
          <DriveToolbar
            parentId={null}
            itemIds={driveItems.map((item) => item.id)}
            sort={sort}
            sortDisabled={isSearchMode}
            isFetching={isManualRefreshing}
            onSortChange={handleSortChange}
            onRefresh={() => {
              void handleRefresh();
            }}
          />

          <div className={classes.view}>
            {showContentSkeleton ? (
              <DriveContentSkeleton viewMode={viewMode} />
            ) : isSearchMode && driveItems.length === 0 ? (
              <Result status="info" title="No results found" subTitle={`No files or folders match "${query}".`} />
            ) : viewMode === "list" ? (
              <DriveListView
                items={driveItems}
                sort={sort}
                sortDisabled={isSearchMode}
                onSortChange={handleSortChange}
                onOpenItem={handleOpenItem}
                onPrefetchItem={prefetchFolder}
              />
            ) : (
              <DriveGridView
                items={driveItems}
                previewPaneOpen={previewPaneOpen}
                onOpenItem={handleOpenItem}
                onPrefetchItem={prefetchFolder}
              />
            )}
          </div>

          {hasNextPage && !showContentSkeleton && (
            <div className={classes.pagination}>
              <Button loading={isFetchingNextPage} onClick={() => void fetchNextPage()}>
                Load more
              </Button>
            </div>
          )}
        </div>
      </DrivePreviewLayout>
    </DrivePageShell>
  );
}
