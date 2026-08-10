import { Folder, Search } from "lucide-react";
import { useState } from "react";
import { Button, Empty, Result, Typography } from "antd";
import { DriveListView } from "./DriveListView";
import DriveGridView from "./DriveGridView";
import { useInfiniteDriveList, useInfiniteDriveSearch } from "@/hooks";
import { useNavigate, useSearchParams } from "react-router-dom";
import { DrivePageShell } from "@/components/drive/DrivePageShell";
import { DriveSubHeader } from "@/components/drive/DriveSubHeader";
import { DriveViewActions } from "@/components/drive/DriveViewActions";
import { usePrefetchDriveFolder } from "@/hooks/usePrefetchDriveFolder";
import { LoadingState } from "@/pages/FolderPage/LoadingStates";
import type { DriveItem } from "@/types/api.types";
import classes from "./index.module.css";


type ViewMode = "grid" | "list";

export default function MyDrivePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const prefetchFolder = usePrefetchDriveFolder();
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const query = (searchParams.get("q") ?? "").trim();
  const isSearchMode = query.length > 0;
  const listQuery = useInfiniteDriveList({ limit: 100 });
  const searchQuery = useInfiniteDriveSearch({ q: query, limit: 100 });
  const activeQuery = isSearchMode ? searchQuery : listQuery;
  const { data, isLoading, isError, refetch, isFetching, hasNextPage, fetchNextPage, isFetchingNextPage } = activeQuery;
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
          <Button type="primary" onClick={() => void refetch()}>
            Try again
          </Button>
        }
      />
    );
  }

  const handleOpenItem = (item: DriveItem) => {
    if (item.type === "folder") {
      navigate(`/dashboard/folders/${item.id}`);
    }
  };

  const paginationLabel = hasNextPage ? "more available" : "all loaded";
  const resultLabel = `${driveItems.length} ${driveItems.length === 1 ? "result" : "results"} for "${query}" · ${paginationLabel}`;

  return (
    <DrivePageShell
      header={
        <DriveSubHeader
          title={isSearchMode ? "Search results" : "My Drive"}
          description={
            isSearchMode
              ? resultLabel
              : `${driveItems.length} ${driveItems.length === 1 ? "item" : "items"} · ${paginationLabel}`
          }
          icon={isSearchMode ? Search : Folder}
          actions={
            <DriveViewActions
              parentId={null}
              itemIds={driveItems.map((item) => item.id)}
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
      {isSearchMode && driveItems.length === 0 ? (
        <div className={classes.centeredRow}>
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={
              <div>
                <Typography.Text strong>No results for "{query}"</Typography.Text>
                <Typography.Paragraph type="secondary" className={classes.paragraph}>
                  Check the spelling or try a different search term.
                </Typography.Paragraph>
              </div>
            }
          />
        </div>
      ) : (
        <>
          {viewMode === "list" ? (
            <DriveListView items={driveItems} onOpenItem={handleOpenItem} onPrefetchItem={prefetchFolder} />
          ) : (
            <DriveGridView items={driveItems} onOpenItem={handleOpenItem} onPrefetchItem={prefetchFolder} />
          )}

          {hasNextPage && (
            <div className={classes.centeredRow2}>
              <Button loading={isFetchingNextPage} onClick={() => void fetchNextPage()}>
                Load more
              </Button>
            </div>
          )}
        </>
      )}
    </DrivePageShell>
  );
}
