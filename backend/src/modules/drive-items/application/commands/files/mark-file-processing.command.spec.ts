import { Types } from "mongoose";
import { FileStatus } from "../../../domain/enums/drive-item.enum";
import { MarkFileProcessingCommand } from "./mark-file-processing.command";

describe("MarkFileProcessingCommand", () => {
  it("moves an uploading placeholder to processing", async () => {
    const driveItemId = new Types.ObjectId();
    const findOneAndUpdate = jest.fn().mockResolvedValue({ _id: driveItemId });
    const command = new MarkFileProcessingCommand({
      model: { findOneAndUpdate },
    } as never);

    await expect(command.execute(driveItemId)).resolves.toBeUndefined();
    expect(findOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        _id: driveItemId,
        fileStatus: FileStatus.UPLOADING,
      }),
      { $set: { fileStatus: FileStatus.PROCESSING } },
      { returnDocument: "after" },
    );
  });
});
