import { Button, Card } from "antd";
import type { DriveItem } from "@/types/api.types";
import { fileIcons } from "@/types/file-type";
import { MoreVertical, Share2, Star } from "lucide-react";
import classes from "./QuickAccessCard.module.css";


interface QuickAccessCardProps {
  item: DriveItem;
}

export default function QuickAccessCard({ item }: QuickAccessCardProps) {
  const Icon = fileIcons[item.type];

  return (
    <Card hoverable className={classes.card} styles={{ body: { padding: 16 } }}>
      <div className={classes.row}>
        <span className={classes.centeredRow}>
          <Icon className={classes.icon} />
        </span>
        <div className={classes.div}>
          <div className={classes.row2}>
            <span className={classes.truncatedValue} title={item.name}>{item.name}</span>
            {item.sizeBytes && <Share2 className={classes.icon2} />}
            {item.ownerId && <Star className={classes.icon3} />}
          </div>
          <div className={classes.row3}>
            <span className={classes.truncatedValue2}>{item.createdAt}</span>
            {item.sizeBytes && <><span aria-hidden="true">·</span><span className={classes.span}>{item.sizeBytes}</span></>}
          </div>
        </div>
        <Button type="text" shape="circle" size="small" aria-label={`Open actions for ${item.name}`} icon={<MoreVertical className={classes.icon4} />} />
      </div>
    </Card>
  );
}
