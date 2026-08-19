import { Clock3 } from "lucide-react";

import { DriveCollectionPage } from "@/pages/Dashboard/DriveCollectionPage";

const RECENT_DEFAULT_SORT = { field: "modified", direction: "desc" } as const;

export default function RecentPage() {
  return (
    <DriveCollectionPage
      collection="recent"
      title="Recent"
      description="Recently modified across your Drive"
      icon={Clock3}
      defaultSort={RECENT_DEFAULT_SORT}
      emptyDescription="No recent items"
    />
  );
}
