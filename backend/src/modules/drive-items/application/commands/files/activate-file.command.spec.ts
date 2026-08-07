import { Types } from "mongoose";
import { FileStatus } from "../../../domain/enums/drive-item.enum";
import { ActivateFileCommand } from "./activate-file.command";

describe("ActivateFileCommand", () => {
  it("does not increment child count for an idempotent retry", async () => {
    const storageObjectId = new Types.ObjectId();
    const model = {
      findOneAndUpdate: jest.fn().mockResolvedValue(null),
      findOne: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue({ fileStatus: FileStatus.ACTIVE, storageObjectId }),
        }),
      }),
    };
    const childCounts = { adjust: jest.fn() };
    const command = new ActivateFileCommand({ model } as never, childCounts as never);

    await command.execute({
      driveItemId: new Types.ObjectId(),
      storageObjectId,
      mimeType: "text/plain",
      sizeBytes: 1n,
      extension: "txt",
    });

    expect(childCounts.adjust).not.toHaveBeenCalled();
  });
});
