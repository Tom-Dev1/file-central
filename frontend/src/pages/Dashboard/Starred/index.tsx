import { Star } from "lucide-react";

import { DriveCollectionPage } from "@/pages/Dashboard/DriveCollectionPage";

const STARRED_DEFAULT_SORT = { field: "name", direction: "asc" } as const;

export default function StarredPage() {
  return (
    <DriveCollectionPage
      collection="starred"
      title="Starred"
      description="Items you marked as important"
      icon={Star}
      defaultSort={STARRED_DEFAULT_SORT}
      emptyDescription="No starred items"
    />
  );
}
