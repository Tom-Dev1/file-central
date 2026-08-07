import { ConflictException } from "@nestjs/common";
import { Types } from "mongoose";

jest.mock("../../storage/mime-detector.service", () => ({
  MimeDetectorService: class MimeDetectorService {},
}));

import { CompleteUploadUseCase } from "./complete-upload.use-case";
import { PauseUploadUseCase } from "./pause-upload.use-case";
import { ReapExpiredUploadsUseCase } from "./reap-expired-uploads.use-case";
import {
  UploadMethod,
  UploadStatus,
} from "../schemas/upload-session.schema";

describe("upload application use cases", () => {
  const ownerId = new Types.ObjectId();
  const sessionId = new Types.ObjectId();

  it("does not run completion side effects when another request owns the session", async () => {
    const sessions = {
      findOneAndUpdate: jest.fn().mockResolvedValue(null),
      findOne: jest.fn().mockResolvedValue({
        _id: sessionId,
        ownerId,
        driveItemId: new Types.ObjectId(),
        status: UploadStatus.PROCESSING,
        expiresAt: new Date(Date.now() + 60_000),
      }),
    };
    const storage = { headObject: jest.fn() };
    const useCase = new CompleteUploadUseCase(
      sessions as never,
      storage as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );

    await expect(
      useCase.execute(ownerId, sessionId, { parts: [] }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(storage.headObject).not.toHaveBeenCalled();
  });

  it("does not pause a session while completion is processing", async () => {
    const sessions = {
      findOneAndUpdate: jest.fn().mockResolvedValue(null),
      findOne: jest.fn().mockResolvedValue({
        status: UploadStatus.PROCESSING,
        expiresAt: new Date(Date.now() + 60_000),
      }),
    };
    const useCase = new PauseUploadUseCase(sessions as never);

    await expect(useCase.execute(ownerId, sessionId)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it("does not clean an expired upload when the atomic claim is lost", async () => {
    const candidate = {
      _id: sessionId,
      ownerId,
      driveItemId: new Types.ObjectId(),
      method: UploadMethod.SINGLE,
      status: UploadStatus.PENDING,
      temporaryObjectKey: "objects/test/session",
      providerUploadId: null,
      declaredSizeBytes: 10n,
      idempotencyKey: "test-upload",
    };
    const sessions = {
      find: jest.fn().mockReturnValue({
        limit: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue([candidate]),
        }),
      }),
      findOneAndUpdate: jest.fn().mockResolvedValue(null),
    };
    const storage = {
      abortMultipartUpload: jest.fn(),
      deleteObject: jest.fn(),
    };
    const quota = { release: jest.fn() };
    const markFileFailed = { execute: jest.fn() };
    const useCase = new ReapExpiredUploadsUseCase(
      sessions as never,
      storage as never,
      quota as never,
      markFileFailed as never,
    );

    await expect(useCase.execute()).resolves.toBe(0);
    expect(storage.deleteObject).not.toHaveBeenCalled();
    expect(quota.release).not.toHaveBeenCalled();
    expect(markFileFailed.execute).not.toHaveBeenCalled();
  });
});
