import { Folder } from "lucide-react";
import { useState } from "react";
import { DriveListView } from "./DriveListView";
import DriveGridView from "./DriveGridView";
import { useDriveList } from "@/hooks";
import { useNavigate } from "react-router-dom";
import { DrivePageShell } from "@/components/drive/DrivePageShell";
import { DriveSubHeader } from "@/components/drive/DriveSubHeader";
import { DriveViewActions } from "@/components/drive/DriveViewActions";
import { usePrefetchDriveFolder } from "@/hooks/usePrefetchDriveFolder";
import { LoadingState } from "@/pages/FolderPage/LoadingStates";

type ViewMode = "grid" | "list";

export default function MyDrivePage() {
  const navigate = useNavigate();
  const prefetchFolder = usePrefetchDriveFolder();
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const { data, isLoading, isError, refetch, isFetching } = useDriveList();
  const driveItems = data?.items ?? [];
  if (isLoading) {
    return <LoadingState message="Loadings files ..." />;
  }

  if (isError) {
    return <div className="py-12 text-center text-sm text-destructive">Unable to load files.</div>;
  }
  const handleOpenItem = (item: (typeof driveItems)[number]) => {
    if (item.type === "folder") {
      navigate(`/dashboard/folders/${item.id}`);
    }
  };
  return (
    <DrivePageShell
      header={
        <DriveSubHeader
          title="My Drive"
          // description={`${driveItems.length} ${driveItems.length === 1 ? "item" : "items"}`}
          icon={Folder}
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
      {!isLoading &&
        !isError &&
        (viewMode === "list" ? (
          <DriveListView items={driveItems} onOpenItem={handleOpenItem} onPrefetchItem={prefetchFolder} />
        ) : (
          <DriveGridView items={driveItems} onOpenItem={handleOpenItem} onPrefetchItem={prefetchFolder} />
        ))}
    </DrivePageShell>
  );
}
