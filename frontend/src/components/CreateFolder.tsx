import { useState, type SubmitEventHandler } from "react";
import { FolderPlus, LoaderCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCreateFolder } from "@/hooks";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Label } from "./ui/label";

interface CreateFolderButtonProps {
  parentId?: string | null;
  className?: string;
}

export function CreateFolderButton({ parentId, className }: CreateFolderButtonProps) {
  const [folderName, setFolderName] = useState("");

  const createFolder = useCreateFolder();
  const [dialogOpen, setDialogOpen] = useState(false);

  const handleSubmit: SubmitEventHandler<HTMLFormElement> = (event) => {
    event.preventDefault();

    const normalizedName = folderName.trim();

    if (!normalizedName) {
      toast.error("Folder name is required.");

      return;
    }

    createFolder.mutate(
      {
        name: normalizedName,
        parentId: parentId ?? null,
      },
      {
        onSuccess: () => {
          toast.success("Folder created successfully.", {
            description: normalizedName,
          });

          setFolderName("");
          setDialogOpen(false);
        },

        onError: (error) => {
          toast.error("Unable to create folder.", {
            description: error instanceof Error ? error.message : "Please try again.",
          });
        },
      }
    );
  };
  const handleDialogChange = (open: boolean) => {
    if (createFolder.isPending) {
      return;
    }

    setDialogOpen(open);

    if (!open) {
      setFolderName("");
    }
  };
  return (
    <>
      <Button
        type="button"
        variant="secondary"
        size="lg"
        className={cn(
          "w-full justify-start  border-0 bg-transparent shadow-none hover:bg-accent cursor-pointer",
          className
        )}
        onClick={() => setDialogOpen(true)}
      >
        <FolderPlus className="mr-2 size-4" />
        New folder
      </Button>

      <Dialog open={dialogOpen} onOpenChange={handleDialogChange}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle>Create new folder</DialogTitle>

              <DialogDescription>Enter a name for the new folder.</DialogDescription>
            </DialogHeader>

            <div className="py-5">
              <Label htmlFor="folder-name" className="sr-only">
                Folder name
              </Label>

              <Input
                id="folder-name"
                value={folderName}
                placeholder="Untitled folder"
                autoComplete="off"
                autoFocus
                maxLength={255}
                disabled={createFolder.isPending}
                onChange={(event) => setFolderName(event.target.value)}
              />

              <p className="mt-2 text-xs text-muted-foreground">{folderName.length}/255 characters</p>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                disabled={createFolder.isPending}
                onClick={() => handleDialogChange(false)}
              >
                Cancel
              </Button>

              <Button type="submit" disabled={createFolder.isPending || !folderName.trim()}>
                {createFolder.isPending ? (
                  <LoaderCircle className="mr-2 size-4 animate-spin" />
                ) : (
                  <FolderPlus className="mr-2 size-4" />
                )}

                {createFolder.isPending ? "Creating..." : "Create folder"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
