import { Card, Skeleton } from "antd";

import classes from "./DriveContentSkeleton.module.css";

interface DriveContentSkeletonProps {
  viewMode: "grid" | "list";
}

const SKELETON_ITEM_COUNT = 8;

export function DriveContentSkeleton({ viewMode }: DriveContentSkeletonProps) {
  if (viewMode === "list") {
    return (
      <div role="table" aria-label="Refreshing Drive items" aria-busy="true" className={classes.list}>
        <div role="row" className={classes.listHeader}>
          <div aria-hidden="true" />
          <Skeleton.Input active size="small" className={classes.headerName} />
          <Skeleton.Input active size="small" className={classes.headerModified} />
          <Skeleton.Input active size="small" className={classes.headerType} />
          <Skeleton.Input active size="small" className={classes.headerSize} />
          <div aria-hidden="true" />
        </div>

        <div role="rowgroup" className={classes.listBody}>
          {Array.from({ length: SKELETON_ITEM_COUNT }, (_, index) => (
            <div role="row" key={index} className={classes.listRow}>
              <div aria-hidden="true" />
              <div role="cell" className={classes.nameCell}>
                <Skeleton.Avatar active shape="square" size={20} />
                <Skeleton.Input active size="small" className={classes.nameLine} />
              </div>
              <div role="cell">
                <Skeleton.Input active size="small" className={classes.modifiedLine} />
              </div>
              <div role="cell">
                <Skeleton.Input active size="small" className={classes.typeLine} />
              </div>
              <div role="cell">
                <Skeleton.Input active size="small" className={classes.sizeLine} />
              </div>
              <div role="cell" className={classes.actionCell}>
                <Skeleton.Button active shape="circle" size="small" className={classes.actionButton} />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div aria-label="Refreshing Drive items" aria-busy="true" className={classes.gridViewport}>
      <div className={classes.grid}>
        {Array.from({ length: SKELETON_ITEM_COUNT }, (_, index) => (
          <Card
            key={index}
            variant="outlined"
            classNames={{ root: classes.gridCard, body: classes.gridCardBody }}
          >
            <div className={classes.cardTop}>
              <span aria-hidden="true" />
              <Skeleton.Button active shape="circle" size="small" className={classes.cardAction} />
            </div>

            <div className={classes.cardHero}>
              <div className={classes.cardIconSurface}>
                <Skeleton.Avatar active shape="square" size={48} />
              </div>
            </div>

            <div className={classes.cardName}>
              <Skeleton.Avatar active shape="square" size={20} />
              <Skeleton.Input active size="small" className={classes.cardNameLine} />
            </div>

            <div className={classes.cardMetadata}>
              <Skeleton.Input active size="small" className={classes.cardDateLine} />
              <Skeleton.Input active size="small" className={classes.cardTypeLine} />
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
