import { Button } from "./ui/button";
import { Plus } from "lucide-react";
import { UploadFileButton } from "./UploadFileButton";
import { UploadFolderButton } from "./UploadFoldersButton";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { CreateFolderButton } from "./CreateFolder";

interface IPopoverUpload {
  parentId?: string | null;
  className?: string;
}

const PopoverUpload = ({ parentId, className }: IPopoverUpload) => {
  console.log(`parentid`, parentId);

  return (
    <div>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            className={cn(
              "h-12 w-full justify-start rounded-2xl border-border/80 bg-background px-4 shadow-sm hover:bg-accent hover:text-accent-foreground",
              className
            )}
          >
            <Plus className="mr-3 size-5" />
            New
          </Button>
        </PopoverTrigger>

        <PopoverContent align="start" className="w-56">
          <CreateFolderButton parentId={parentId} />
          <UploadFileButton parentId={parentId} />
          <UploadFolderButton parentId={parentId} />
        </PopoverContent>
      </Popover>
    </div>
  );
};

export default PopoverUpload;
