import { Types } from "mongoose";
import { StorageObjectsService } from "./storage-objects.services";

describe("StorageObjectsService", () => {
  it("uses the configured bucket when the caller omits it", async () => {
    const createdId = new Types.ObjectId();
    const model = {
      create: jest.fn().mockResolvedValue({ _id: createdId }),
    };
    const storage = { getBucketName: jest.fn().mockReturnValue("file-central") };
    const service = new StorageObjectsService(model as never, storage as never);
    const ownerId = new Types.ObjectId();

    await expect(
      service.create({
        ownerId,
        objectKey: "objects/test",
        sizeBytes: 1n,
        mimeType: "text/plain",
        checksumSha256: null,
      }),
    ).resolves.toEqual({ id: createdId });
    expect(model.create).toHaveBeenCalledWith(
      expect.objectContaining({ bucket: "file-central" }),
    );
  });
});
