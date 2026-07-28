import { useMutation, useQueryClient } from "@tanstack/react-query";
import { driveKeys } from "../lib/query-keys";
import { uploadFolder, type UploadFolderOptions, type UploadFolderResult } from "@/apis/folder-upload";

/**
 *
 *   const uploadFolder = useUploadFolder();
 *   const [progress, setProgress] = useState<UploadFolderProgress | null>(null);
 *
 *   uploadFolder.mutate({
 *     files: event.target.files, // from <input webkitdirectory multiple>
 *     parentId: currentFolderId,
 *     onProgress: setProgress,
 *   });
 *
 * `progress` updates synchronously via the onProgress callback as each
 * folder/file completes - the mutation's own isPending/isSuccess only
 * flip once the ENTIRE batch settles, so use `progress` for a live bar
 * and `uploadFolder.isPending` just to disable the picker button.
 */
export function useUploadFolder() {
  const queryClient = useQueryClient();
  return useMutation<UploadFolderResult, Error, UploadFolderOptions>({
    mutationFn: (options) => uploadFolder(options),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: driveKeys.all });
    },
  });
}
