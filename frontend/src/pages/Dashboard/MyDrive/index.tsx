import { Folder, Search } from "lucide-react";
import { useState } from "react";
import { Button, Empty, Result, Typography } from "antd";
import { useNavigate, useSearchParams } from "react-router-dom";

import DriveGridView from "./DriveGridView";
import { DriveListView } from "./DriveListView";

import { DrivePageShell } from "@/components/drive/DrivePageShell";
import { DriveSubHeader } from "@/components/drive/DriveSubHeader";
import { DriveViewActions } from "@/components/drive/DriveViewActions";

import { useInfiniteDriveList, useInfiniteDriveSearch } from "@/hooks";
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

  const listQuery = useInfiniteDriveList({
    limit: 100,
  });

  const searchQuery = useInfiniteDriveSearch({
    q: query,
    limit: 100,
  });

  const activeQuery = isSearchMode ? searchQuery : listQuery;

  const { data, isLoading, isError, refetch, isFetching, hasNextPage, fetchNextPage, isFetchingNextPage } = activeQuery;

  const driveItems = data?.pages.flatMap((page) => page.items) ?? [];

  if (isLoading) {
    return <LoadingState message={isSearchMode ? `Searching for "${query}"...` : "Loading files..."} />;
  }

  if (isError) {
    return (
      <div className={classes.stateContainer}>
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
      </div>
    );
  }

  const handleOpenItem = (item: DriveItem) => {
    if (item.type === "folder") {
      navigate(`/dashboard/folders/${item.id}`);
    }
  };

  const paginationLabel = hasNextPage ? "more available" : "all loaded";

  const countLabel = `${driveItems.length} ${driveItems.length === 1 ? "item" : "items"}`;

  const resultLabel = `${driveItems.length} ${
    driveItems.length === 1 ? "result" : "results"
  } for "${query}" · ${paginationLabel}`;

  return (
    <DrivePageShell
      header={
        <DriveSubHeader
          title={isSearchMode ? "Search results" : "My Drive"}
          description={isSearchMode ? resultLabel : `${countLabel} · ${paginationLabel}`}
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
      <section className={classes.content} aria-label={isSearchMode ? "Search results" : "My Drive files"}>
        {isSearchMode && driveItems.length === 0 ? (
          <div className={classes.emptyState}>
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              className={classes.empty}
              description={
                <div className={classes.emptyDescription}>
                  <Typography.Text strong className={classes.emptyTitle}>
                    No results for "{query}"
                  </Typography.Text>

                  <Typography.Paragraph type="secondary" className={classes.emptyCopy}>
                    Check the spelling or try a different search term.
                  </Typography.Paragraph>
                </div>
              }
            />
          </div>
        ) : driveItems.length === 0 ? (
          <div className={classes.emptyState}>
            <div className={classes.emptyIcon}>
              <Folder />
            </div>

            <Typography.Title level={4} className={classes.emptyTitle}>
              Your Drive is empty
            </Typography.Title>

            <Typography.Paragraph type="secondary" className={classes.emptyCopy}>
              Upload files or create folders to start organizing your content.
            </Typography.Paragraph>
          </div>
        ) : (
          <>
            <div className={classes.driveView} data-view={viewMode}>
              {viewMode === "list" ? (
                <DriveListView items={driveItems} onOpenItem={handleOpenItem} onPrefetchItem={prefetchFolder} />
              ) : (
                <DriveGridView items={driveItems} onOpenItem={handleOpenItem} onPrefetchItem={prefetchFolder} />
              )}
            </div>

            {hasNextPage && (
              <div className={classes.pagination}>
                <Button
                  size="large"
                  loading={isFetchingNextPage}
                  className={classes.loadMoreButton}
                  onClick={() => void fetchNextPage()}
                >
                  Load more
                </Button>
              </div>
            )}
          </>
        )}
      </section>
    </DrivePageShell>
  );
}
