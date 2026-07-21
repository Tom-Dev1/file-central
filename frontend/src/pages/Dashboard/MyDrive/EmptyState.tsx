import { Button } from "@/components/ui/button";
import { Search, Upload } from "lucide-react";

export default function EmptyState() {
  return (
    <div className="flex min-h-80 flex-col items-center justify-center px-6 text-center">
      <span className="flex size-16 items-center justify-center rounded-full bg-muted">
        <Search className="size-7 text-muted-foreground" />
      </span>

      <h3 className="mt-5 font-semibold">No files found</h3>

      <p className="mt-2 max-w-sm text-sm text-muted-foreground">
        Try changing your search query or upload a new file.
      </p>

      <Button type="button" className="mt-5">
        <Upload className="mr-2 size-4" />
        Upload file
      </Button>
    </div>
  );
}
