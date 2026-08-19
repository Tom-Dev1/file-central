import { StarFilled, StarOutlined } from "@ant-design/icons";
import { App, Button } from "antd";

import { useSetDriveItemStarred } from "@/hooks";
import type { DriveItem } from "@/types/api.types";

import classes from "./DriveListView.module.css";

interface DriveStarButtonProps {
  item: DriveItem;
}

export function DriveStarButton({ item }: DriveStarButtonProps) {
  const { message } = App.useApp();
  const setStarred = useSetDriveItemStarred();
  const label = item.isStarred ? `Remove ${item.name} from Starred` : `Add ${item.name} to Starred`;

  const handleClick = () => {
    const starred = !item.isStarred;

    setStarred.mutate(
      { id: item.id, starred },
      {
        onSuccess: () => void message.success(starred ? "Added to Starred" : "Removed from Starred"),
        onError: (error) =>
          void message.error(error instanceof Error ? error.message : "Unable to update Starred."),
      },
    );
  };

  return (
    <Button
      type="text"
      shape="circle"
      aria-label={label}
      title={label}
      icon={item.isStarred ? <StarFilled /> : <StarOutlined />}
      loading={setStarred.isPending}
      className={item.isStarred ? classes.starButtonActive : classes.starButton}
      onClick={handleClick}
    />
  );
}
