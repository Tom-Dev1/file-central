import { PlusOutlined } from "@ant-design/icons";
import { Button, Popover } from "antd";
import { UploadFileButton } from "./UploadFileButton";
import { UploadFolderButton } from "./UploadFoldersButton";
import { cn } from "@/lib/utils";
import { CreateFolderButton } from "./CreateFolder";

interface IPopoverUpload {
  parentId?: string | null;
  className?: string;
}

const PopoverUpload = ({ parentId, className }: IPopoverUpload) => {
  return (
    <Popover
      trigger="click"
      placement="bottomLeft"
      arrow={false}
      title="Create or upload"
      content={
        <div className="flex w-52 flex-col">
          <CreateFolderButton parentId={parentId} />
          <UploadFileButton parentId={parentId} />
          <UploadFolderButton parentId={parentId} />
        </div>
      }
    >
      <Button
        type="default"
        className={cn("h-12 w-full justify-start rounded-2xl px-4 shadow-sm", className)}
        icon={<PlusOutlined />}
      >
        New
      </Button>
    </Popover>
  );
};

export default PopoverUpload;
