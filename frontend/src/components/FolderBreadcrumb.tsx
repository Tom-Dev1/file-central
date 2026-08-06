import {
  EllipsisOutlined,
  LoadingOutlined,
  RightOutlined,
} from "@ant-design/icons";
import { Breadcrumb, Button, Dropdown, Skeleton, Spin, Typography, type MenuProps } from "antd";
import { startTransition } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";

import { getBreadcrumbParts } from "@/constants/file-constants";
import { useFolderBreadcrumbs } from "@/hooks/useDrive";
import { driveKeys } from "@/lib/query-keys";
import { cn } from "@/lib/utils";
import type { FolderBreadcrumbItem } from "@/types/drive.type";

interface FolderBreadcrumbsProps {
  folderId: string;
  className?: string;
}

export function FolderBreadcrumbs({ folderId, className }: FolderBreadcrumbsProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: breadcrumbs = [], isLoading, isFetching, isPending } = useFolderBreadcrumbs(folderId);
  const { visible, hidden } = getBreadcrumbParts(breadcrumbs);

  const handleNavigate = (item: FolderBreadcrumbItem) => {
    if (item.id === folderId || item.id === "collapsed") {
      return;
    }

    const targetIndex = breadcrumbs.findIndex((breadcrumb) => breadcrumb.id === item.id);

    if (targetIndex >= 0) {
      queryClient.setQueryData<FolderBreadcrumbItem[]>(
        driveKeys.breadcrumb(item.id),
        breadcrumbs.slice(0, targetIndex + 1)
      );
    }

    startTransition(() => {
      navigate(`/dashboard/folders/${item.id}`);
    });
  };

  if ((isLoading || isPending) && breadcrumbs.length === 0) {
    return (
      <div className={cn("flex min-h-9 items-center gap-2", className)}>
        <Skeleton.Button active size="small" className="w-24" />
        <RightOutlined className="text-xs text-muted-foreground/40" />
        <Skeleton.Button active size="small" className="w-36" />
      </div>
    );
  }

  const collapsedItems: MenuProps["items"] = hidden.map((item) => ({
    key: item.id,
    label: (
      <span className="block max-w-52 truncate" title={item.name}>
        {item.name}
      </span>
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
            trigger={["click"]}
            menu={{
              items: collapsedItems,
              onClick: ({ key }) => {
                const selectedItem = hidden.find((hiddenItem) => hiddenItem.id === key);
                if (selectedItem) {
                  handleNavigate(selectedItem);
                }
              },
            }}
          >
            <Button
              type="text"
              size="small"
              shape="circle"
              aria-label="Show hidden folders"
              icon={<EllipsisOutlined />}
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
            strong
            aria-current="page"
            className="block max-w-64 truncate text-xl"
            title={item.name}
          >
            {item.name}
          </Typography.Text>
        ),
      };
    }

    return {
      key: item.id,
      title: (
        <Button
          type="text"
          className="h-auto max-w-48 px-1 text-xl font-normal text-muted-foreground"
          title={item.name}
          onClick={() => handleNavigate(item)}
        >
          <span className="truncate">{item.name}</span>
        </Button>
      ),
    };
  });

  return (
    <nav aria-label="Folder breadcrumb" className={cn("flex min-h-9 min-w-0 items-center", className)}>
      <Breadcrumb
        separator={<RightOutlined className="text-xs text-muted-foreground/60" />}
        items={items}
        className="min-w-0 overflow-hidden"
      />
      <span className="ml-2 flex size-5 shrink-0 items-center justify-center">
        {isFetching && breadcrumbs.length > 0 && (
          <Spin
            size="small"
            indicator={<LoadingOutlined spin />}
            aria-label="Updating breadcrumb"
          />
        )}
      </span>
    </nav>
  );
}
