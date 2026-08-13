import { Folder, Search } from "lucide-react";
import { useState } from "react";
import { Button, Result } from "antd";
import { useNavigate, useSearchParams } from "react-router-dom";
import DriveGridView from "./DriveGridView";
import { DriveListView } from "@/components/drive/list";
import { DrivePageShell } from "@/components/drive/DrivePageShell";
import { DriveSubHeader } from "@/components/drive/DriveSubHeader";
import { DriveToolbar } from "@/components/drive/toolbar/DriveToolBar";
import { DriveViewModeToggle } from "@/components/drive/DriveViewModeToggle";
import { useInfiniteDriveList, useInfiniteDriveSearch } from "@/hooks";
import { usePrefetchDriveFolder } from "@/hooks/usePrefetchDriveFolder";
import { LoadingState } from "@/pages/FolderPage/LoadingStates";
import type { DriveItem } from "@/types/api.types";
import type { DriveSortState, DriveViewMode } from "@/types/drive.type";
import classes from "./index.module.css";
export default function MyDrivePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const prefetchFolder = usePrefetchDriveFolder();

  const [viewMode, setViewMode] = useState<DriveViewMode>("list");

  const [sort, setSort] = useState<DriveSortState>({
    field: "name",
    direction: "asc",
  });

  const query = (searchParams.get("q") ?? "").trim();

  const isSearchMode = query.length > 0;

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

  const { data, isLoading, isError, isFetching, hasNextPage, isFetchingNextPage, refetch, fetchNextPage } = activeQuery;

  const driveItems = data?.pages.flatMap((page) => page.items) ?? [];

  if (isLoading) {
    return <LoadingState message={isSearchMode ? `Searching for "${query}"...` : "Loading files..."} />;
  }

  if (isError) {
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

    navigate(`/dashboard/folders/${item.id}`);
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
          actions={<DriveViewModeToggle value={viewMode} onChange={setViewMode} />}
        />
      }
    >
      <div className={classes.browser}>
        <DriveToolbar
          parentId={null}
          itemIds={driveItems.map((item) => item.id)}
          sort={sort}
          sortDisabled={isSearchMode}
          isFetching={isFetching}
          onSortChange={setSort}
          onRefresh={() => {
            void refetch();
          }}
        />

        <div className={classes.view}>
          {isSearchMode && driveItems.length === 0 ? (
            <Result status="info" title="No results found" subTitle={`No files or folders match "${query}".`} />
          ) : viewMode === "list" ? (
            <DriveListView
              items={driveItems}
              sort={sort}
              sortDisabled={isSearchMode}
              onSortChange={setSort}
              onOpenItem={handleOpenItem}
              onPrefetchItem={prefetchFolder}
            />
          ) : (
            <DriveGridView items={driveItems} onOpenItem={handleOpenItem} onPrefetchItem={prefetchFolder} />
          )}
        </div>

        {hasNextPage && (
          <div className={classes.pagination}>
            <Button loading={isFetchingNextPage} onClick={() => void fetchNextPage()}>
              Load more
            </Button>
          </div>
        )}
      </div>
    </DrivePageShell>
  );
}
