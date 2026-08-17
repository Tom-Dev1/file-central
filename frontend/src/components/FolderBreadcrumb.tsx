import {
  EllipsisOutlined,
  LoadingOutlined,
  RightOutlined,
} from "@ant-design/icons";
import { useQueryClient } from "@tanstack/react-query";
import {
  Breadcrumb,
  Button,
  Dropdown,
  Skeleton,
  Spin,
  Tooltip,
  Typography,
  type MenuProps,
} from "antd";
import { clsx as cn } from "clsx";
import { startTransition, useLayoutEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import { getBreadcrumbParts } from "@/constants/file-constants";
import { useFolderBreadcrumbs } from "@/hooks/useDrive";
import { driveKeys } from "@/lib/query-keys";
import type { FolderBreadcrumbItem } from "@/types/drive.type";
import { createDriveSortSearch, readDriveSortParams } from "@/utils/drive-sort-params";

import styles from "./FolderBreadcrumb.module.css";

interface FolderBreadcrumbsProps {
  folderId: string;
  className?: string;
}

interface TruncatedBreadcrumbLabelProps {
  text: string;
  className: string;
}

function TruncatedBreadcrumbLabel({
  text,
  className,
}: TruncatedBreadcrumbLabelProps) {
  const labelRef = useRef<HTMLSpanElement>(null);
  const [isTruncated, setIsTruncated] = useState(false);

  useLayoutEffect(() => {
    const label = labelRef.current;

    if (!label) {
      return;
    }

    const updateTruncatedState = () => {
      setIsTruncated(label.scrollWidth > label.clientWidth);
    };

    updateTruncatedState();

    const resizeObserver = new ResizeObserver(updateTruncatedState);
    resizeObserver.observe(label);

    return () => resizeObserver.disconnect();
  }, [text]);

  return (
    <Tooltip
      mouseEnterDelay={0.35}
      placement="bottom"
      title={isTruncated ? text : null}
    >
      <span ref={labelRef} className={className}>
        {text}
      </span>
    </Tooltip>
  );
}

export function FolderBreadcrumbs({
  folderId,
  className,
}: FolderBreadcrumbsProps) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const sortSearch = createDriveSortSearch(readDriveSortParams(searchParams));
  const queryClient = useQueryClient();
  const {
    data: breadcrumbs = [],
    isLoading,
    isFetching,
    isPending,
  } = useFolderBreadcrumbs(folderId);
  const { visible, hidden } = getBreadcrumbParts(breadcrumbs);

  const handleNavigate = (item: FolderBreadcrumbItem) => {
    if (item.id === folderId || item.id === "collapsed") {
      return;
    }

    const targetIndex = breadcrumbs.findIndex(
      (breadcrumb) => breadcrumb.id === item.id,
    );

    if (targetIndex >= 0) {
      queryClient.setQueryData<FolderBreadcrumbItem[]>(
        driveKeys.breadcrumb(item.id),
        breadcrumbs.slice(0, targetIndex + 1),
      );
    }

    startTransition(() => {
      navigate(`/dashboard/folders/${item.id}?${sortSearch}`);
    });
  };

  if ((isLoading || isPending) && breadcrumbs.length === 0) {
    return (
      <div
        aria-label="Loading folder breadcrumb"
        className={cn(styles.folderBreadcrumbsLoading, className)}
        role="status"
      >
        <Skeleton.Button
          active
          className={styles.folderBreadcrumbsSkeletonShort}
          size="small"
        />
        <RightOutlined
          aria-hidden="true"
          className={styles.folderBreadcrumbsLoadingSeparator}
        />
        <Skeleton.Button
          active
          className={styles.folderBreadcrumbsSkeletonLong}
          size="small"
        />
      </div>
    );
  }

  const collapsedItems: MenuProps["items"] = hidden.map((item) => ({
    key: item.id,
    label: (
      <TruncatedBreadcrumbLabel
        className={styles.folderBreadcrumbsMenuLabel}
        text={item.name}
      />
    ),
  }));

  const items = visible.map((item) => {
    const isCollapsed = item.id === "collapsed";
    const isCurrent = item.id === folderId;

    if (isCollapsed) {
      return {
        key: item.id,
        title: (
          <Dropdown
            menu={{
              items: collapsedItems,
              onClick: ({ key }) => {
                const selectedItem = hidden.find(
                  (hiddenItem) => hiddenItem.id === key,
                );

                if (selectedItem) {
                  handleNavigate(selectedItem);
                }
              },
            }}
            trigger={["click"]}
          >
            <Button
              aria-label="Show hidden folders"
              className={styles.folderBreadcrumbsCollapsedButton}
              icon={<EllipsisOutlined />}
              size="small"
              type="text"
            />
          </Dropdown>
        ),
      };
    }

    if (isCurrent) {
      return {
        key: item.id,
        title: (
          <Typography.Text
            aria-current="page"
            className={styles.folderBreadcrumbsCurrent}
          >
            <TruncatedBreadcrumbLabel
              className={styles.folderBreadcrumbsCurrentLabel}
              text={item.name}
            />
          </Typography.Text>
        ),
      };
    }

    return {
      key: item.id,
      title: (
        <Button
          className={styles.folderBreadcrumbsAncestor}
          onClick={() => handleNavigate(item)}
          type="text"
        >
          <TruncatedBreadcrumbLabel
            className={styles.folderBreadcrumbsAncestorLabel}
            text={item.name}
          />
        </Button>
      ),
    };
  });

  return (
    <div className={cn(styles.folderBreadcrumbs, className)}>
      <Breadcrumb
        aria-label="Folder path"
        classNames={{
          root: styles.folderBreadcrumbsBreadcrumb,
          item: styles.folderBreadcrumbsItem,
          separator: styles.folderBreadcrumbsSeparator,
        }}
        items={items}
        separator={<RightOutlined aria-hidden="true" />}
      />

      {isFetching && breadcrumbs.length > 0 && (
        <Spin
          aria-label="Updating breadcrumb"
          className={styles.folderBreadcrumbsUpdating}
          indicator={<LoadingOutlined spin />}
          size="small"
        />
      )}
    </div>
  );
}
