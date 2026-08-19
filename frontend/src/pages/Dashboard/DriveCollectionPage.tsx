import { ReloadOutlined } from "@ant-design/icons";
import { App, Button, Empty, Result } from "antd";
import type { LucideIcon } from "lucide-react";
import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { DrivePageShell } from "@/components/drive/DrivePageShell";
import { DriveSubHeader } from "@/components/drive/DriveSubHeader";
import { DriveListView } from "@/components/drive/list";
import { DriveToolbar } from "@/components/drive/toolbar/DriveToolBar";
import { useDriveSelection } from "@/contexts/driveSelectionContext";
import { useInfiniteDriveCollection } from "@/hooks";
import { usePrefetchDriveFolder } from "@/hooks/usePrefetchDriveFolder";
import type { DriveCollection, DriveItem } from "@/types/api.types";
import type { DriveSortState } from "@/types/drive.type";
import {
  createDriveSortSearch,
  readDriveSortParams,
  writeDriveSortParams,
} from "@/utils/drive-sort-params";

import classes from "./DriveCollectionPage.module.css";

interface DriveCollectionPageProps {
  collection: DriveCollection;
  title: string;
  description: string;
  icon: LucideIcon;
  defaultSort: DriveSortState;
  emptyDescription: string;
}

export function DriveCollectionPage({
  collection,
  title,
  description,
  icon,
  defaultSort,
  emptyDescription,
}: DriveCollectionPageProps) {
  const { message } = App.useApp();
  const location = useLocation();
  const navigate = useNavigate();
  const prefetchFolder = usePrefetchDriveFolder();
  const { clearSelection } = useDriveSelection();
  const sort = readDriveSortParams(new URLSearchParams(location.search), defaultSort);

  const query = useInfiniteDriveCollection(collection, {
    limit: 100,
    sort: sort.field,
    direction: sort.direction,
  });
  const items = query.data?.pages.flatMap((page) => page.items) ?? [];
  const loading = query.isLoading || (query.isFetching && !query.isFetchingNextPage);

  useEffect(() => {
    clearSelection();
  }, [clearSelection, collection]);

  useEffect(() => {
    const currentParams = new URLSearchParams(location.search);

    if (
      currentParams.get("sort") === sort.field &&
      currentParams.get("direction") === sort.direction
    ) {
      return;
    }

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
      { replace: true },
    );
  }, [location.hash, location.pathname, location.search, navigate, sort.direction, sort.field]);

  const handleOpenItem = (item: DriveItem) => {
    if (item.type !== "folder") {
      return;
    }

    clearSelection();
    navigate(`/dashboard/folders/${item.id}?${createDriveSortSearch(sort)}`);
  };

  const handleSortChange = (nextSort: DriveSortState) => {
    const nextParams = writeDriveSortParams(new URLSearchParams(location.search), nextSort);
    navigate(
      {
        pathname: location.pathname,
        search: `?${nextParams.toString()}`,
        hash: location.hash,
      },
      { replace: true },
    );
  };

  const handleRefresh = async () => {
    const result = await query.refetch();

    if (result.isError) {
      void message.error(`Unable to refresh ${title}.`);
    }
  };

  return (
    <DrivePageShell
      header={
        <DriveSubHeader
          title={title}
          titleHref={null}
          description={`${description} · ${items.length} ${items.length === 1 ? "item" : "items"}`}
          icon={icon}
          actions={
            <Button
              icon={<ReloadOutlined />}
              loading={loading}
              onClick={() => void handleRefresh()}
            >
              Refresh
            </Button>
          }
        />
      }
    >
      {query.isError && !query.data ? (
        <Result
          status="error"
          title={`Unable to load ${title}`}
          subTitle="Your files could not be loaded. Please try again."
          extra={
            <Button icon={<ReloadOutlined />} onClick={() => void query.refetch()}>
              Try again
            </Button>
          }
        />
      ) : (
        <div className={classes.collection}>
          <DriveToolbar
            items={items}
            sort={sort}
            hideBrowseToolbar
            isFetching={loading}
            onSortChange={handleSortChange}
            onRefresh={() => void handleRefresh()}
          />

          <div className={classes.list}>
            <DriveListView
              items={items}
              loading={loading}
              sort={sort}
              onSortChange={handleSortChange}
              onOpenItem={handleOpenItem}
              onPrefetchItem={prefetchFolder}
              ariaLabel={`${title} Drive items`}
              loadingAriaLabel={`Loading ${title} Drive items`}
              emptyState={
                <div className={classes.emptyState}>
                  <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={emptyDescription} />
                </div>
              }
            />
          </div>

          {query.hasNextPage && !loading && (
            <div className={classes.pagination}>
              <Button
                loading={query.isFetchingNextPage}
                onClick={() => void query.fetchNextPage()}
              >
                Load more
              </Button>
            </div>
          )}
        </div>
      )}
    </DrivePageShell>
  );
}
