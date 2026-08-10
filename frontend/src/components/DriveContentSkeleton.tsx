import { Card, Skeleton, Space } from "antd";
import classes from "./DriveContentSkeleton.module.css";


interface DriveContentSkeletonProps {
  viewMode: "grid" | "list";
}

export function DriveContentSkeleton({ viewMode }: DriveContentSkeletonProps) {
  if (viewMode === "list") {
    return (
      <div className={classes.div} aria-label="Loading Drive items">
        {Array.from({ length: 8 }, (_, index) => (
          <div key={index} className={classes.row}>
            <Skeleton.Avatar active shape="square" size="small" />
            <Skeleton.Input active size="small" className={classes.skeletoninput} />
            <Skeleton.Input active size="small" className={classes.skeletoninput2} />
            <Skeleton.Input active size="small" className={classes.skeletoninput3} />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className={classes.responsiveGrid} aria-label="Loading Drive items">
      {Array.from({ length: 8 }, (_, index) => (
        <Card key={index} styles={{ body: { padding: 16 } }}>
          <Space direction="vertical" size={16} className={classes.row2}>
            <div className={classes.spreadRow}><Skeleton.Avatar active shape="square" size="small" /><Skeleton.Avatar active size="small" /></div>
            <div className={classes.centeredRow}><Skeleton.Avatar active shape="square" size={64} /></div>
            <Skeleton.Input active size="small" className={classes.skeletoninput4} />
            <div className={classes.spreadRow}><Skeleton.Input active size="small" className={classes.skeletoninput5} /><Skeleton.Input active size="small" className={classes.skeletoninput6} /></div>
          </Space>
        </Card>
      ))}
    </div>
  );
}
