import { Types } from "mongoose";
import { StorageObjectState, StorageScanStatus } from "./enums/storage-object.enum";
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

  it("uses the preview MIME override with an inline disposition", async () => {
    const storageObjectId = new Types.ObjectId();
    const ownerId = new Types.ObjectId();
    const model = {
      findOne: jest.fn().mockResolvedValue({
        objectKey: "objects/preview",
        mimeType: "application/octet-stream",
        state: StorageObjectState.ACTIVE,
        scanStatus: StorageScanStatus.CLEAN,
      }),
    };
    const storage = {
      getPresignedGetUrl: jest.fn().mockResolvedValue("https://storage.test/preview"),
    };
    const service = new StorageObjectsService(model as never, storage as never);

    await expect(
      service.getPresignedPreviewUrl(storageObjectId, ownerId, "text/plain; charset=utf-8"),
    ).resolves.toEqual({
      url: "https://storage.test/preview",
      expiresInSeconds: 3600,
    });
    expect(storage.getPresignedGetUrl).toHaveBeenCalledWith("objects/preview", {
      expiresIn: 3600,
      responseContentType: "text/plain; charset=utf-8",
      responseContentDisposition: "inline",
    });
  });
});
