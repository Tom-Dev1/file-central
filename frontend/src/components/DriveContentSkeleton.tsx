import { Card, Skeleton, Space } from "antd";

interface DriveContentSkeletonProps {
  viewMode: "grid" | "list";
}

export function DriveContentSkeleton({ viewMode }: DriveContentSkeletonProps) {
  if (viewMode === "list") {
    return (
      <div className="space-y-1 p-4 sm:p-6" aria-label="Loading Drive items">
        {Array.from({ length: 8 }, (_, index) => (
          <div key={index} className="flex h-14 items-center gap-3 rounded-lg px-3">
            <Skeleton.Avatar active shape="square" size="small" />
            <Skeleton.Input active size="small" className="!w-48" />
            <Skeleton.Input active size="small" className="ml-auto !hidden !w-24 sm:!inline-flex" />
            <Skeleton.Input active size="small" className="!hidden !w-16 md:!inline-flex" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-4 p-4 sm:grid-cols-2 sm:p-6 lg:grid-cols-3 xl:grid-cols-4" aria-label="Loading Drive items">
      {Array.from({ length: 8 }, (_, index) => (
        <Card key={index} styles={{ body: { padding: 16 } }}>
          <Space direction="vertical" size={16} className="flex">
            <div className="flex justify-between"><Skeleton.Avatar active shape="square" size="small" /><Skeleton.Avatar active size="small" /></div>
            <div className="flex justify-center py-5"><Skeleton.Avatar active shape="square" size={64} /></div>
            <Skeleton.Input active size="small" className="!w-3/4" />
            <div className="flex justify-between"><Skeleton.Input active size="small" className="!w-20" /><Skeleton.Input active size="small" className="!w-12" /></div>
          </Space>
        </Card>
      ))}
    </div>
  );
}
