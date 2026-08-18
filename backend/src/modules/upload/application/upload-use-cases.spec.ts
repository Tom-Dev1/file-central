import { BadRequestException, ConflictException } from "@nestjs/common";
import { Types } from "mongoose";

jest.mock("../../storage/mime-detector.service", () => ({
  MimeDetectorService: class MimeDetectorService {},
}));

import { CompleteUploadUseCase } from "./complete-upload.use-case";
import { AbortUploadUseCase } from "./abort-upload.use-case";
import { GetUploadStatusUseCase } from "./get-upload-status.use-case";
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
      {} as never,
      {} as never,
    );

    await expect(
      useCase.execute(ownerId, sessionId, { parts: [] }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(storage.headObject).not.toHaveBeenCalled();
  });

  it("discards the placeholder when completion fails before activation", async () => {
    const driveItemId = new Types.ObjectId();
    const session = {
      _id: sessionId,
      ownerId,
      driveItemId,
      method: UploadMethod.SINGLE,
      status: UploadStatus.PROCESSING,
      temporaryObjectKey: "objects/test/session",
      providerUploadId: null,
      declaredSizeBytes: 10n,
      idempotencyKey: "test-upload",
      save: jest.fn().mockResolvedValue(undefined),
    };
    const sessions = { findOneAndUpdate: jest.fn().mockResolvedValue(session) };
    const storage = {
      headObject: jest.fn().mockResolvedValue(null),
      deleteObject: jest.fn().mockResolvedValue(undefined),
    };
    const rollbackActivation = { execute: jest.fn().mockResolvedValue(undefined) };
    const markFileProcessing = { execute: jest.fn() };
    const discardPlaceholder = { execute: jest.fn().mockResolvedValue(undefined) };
    const quota = { release: jest.fn().mockResolvedValue(undefined) };
    const useCase = new CompleteUploadUseCase(
      sessions as never,
      storage as never,
      {} as never,
      {} as never,
      {} as never,
      rollbackActivation as never,
      markFileProcessing as never,
      discardPlaceholder as never,
      quota as never,
    );

    await expect(
      useCase.execute(ownerId, sessionId, { parts: [] }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(markFileProcessing.execute).toHaveBeenCalledWith(driveItemId);
    expect(rollbackActivation.execute).toHaveBeenCalledWith(driveItemId);
    expect(discardPlaceholder.execute).toHaveBeenCalledWith(driveItemId);
    expect(storage.deleteObject).toHaveBeenCalledWith(session.temporaryObjectKey);
    expect(quota.release).toHaveBeenCalledWith(
      ownerId,
      10n,
      "test-upload:failure-release",
    );
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

  it("returns a fresh PUT URL when a single-part upload needs to resume", async () => {
    const session = {
      _id: sessionId,
      ownerId,
      method: UploadMethod.SINGLE,
      status: UploadStatus.PAUSED,
      temporaryObjectKey: "objects/test/session",
      expiresAt: new Date(Date.now() + 60_000),
      save: jest.fn(),
    };
    const sessions = { findOne: jest.fn().mockResolvedValue(session) };
    const storage = {
      headObject: jest.fn().mockResolvedValue(null),
      getPresignedPutUrl: jest.fn().mockResolvedValue("https://storage.test/put"),
    };
    const useCase = new GetUploadStatusUseCase(
      sessions as never,
      {} as never,
      storage as never,
    );

    await expect(useCase.execute(ownerId, sessionId)).resolves.toMatchObject({
      status: UploadStatus.PENDING,
      method: UploadMethod.SINGLE,
      singlePartUploaded: false,
      putUrl: "https://storage.test/put",
    });
    expect(session.save).toHaveBeenCalled();
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
    const parts = { deleteMany: jest.fn() };
    const discardPlaceholder = { execute: jest.fn() };
    const useCase = new ReapExpiredUploadsUseCase(
      sessions as never,
      parts as never,
      storage as never,
      quota as never,
      discardPlaceholder as never,
    );

    await expect(useCase.execute()).resolves.toBe(0);
    expect(storage.deleteObject).not.toHaveBeenCalled();
    expect(quota.release).not.toHaveBeenCalled();
    expect(discardPlaceholder.execute).not.toHaveBeenCalled();
    expect(parts.deleteMany).not.toHaveBeenCalled();
  });

  it("removes an expired upload placeholder after storage and quota cleanup", async () => {
    const driveItemId = new Types.ObjectId();
    const candidate = {
      _id: sessionId,
      ownerId,
      driveItemId,
      method: UploadMethod.SINGLE,
      status: UploadStatus.PENDING,
      temporaryObjectKey: "objects/test/session",
      providerUploadId: null,
      declaredSizeBytes: 10n,
      idempotencyKey: "test-upload",
    };
    const claimed = { ...candidate, status: UploadStatus.EXPIRED };
    const sessions = {
      find: jest.fn().mockReturnValue({
        limit: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue([candidate]),
        }),
      }),
      findOneAndUpdate: jest.fn().mockResolvedValue(claimed),
      updateOne: jest.fn(),
    };
    const parts = { deleteMany: jest.fn() };
    const storage = { abortMultipartUpload: jest.fn(), deleteObject: jest.fn() };
    const quota = { release: jest.fn() };
    const discardPlaceholder = { execute: jest.fn() };
    const useCase = new ReapExpiredUploadsUseCase(
      sessions as never,
      parts as never,
      storage as never,
      quota as never,
      discardPlaceholder as never,
    );

    await expect(useCase.execute()).resolves.toBe(1);
    expect(storage.deleteObject).toHaveBeenCalledWith(candidate.temporaryObjectKey);
    expect(quota.release).toHaveBeenCalledWith(
      ownerId,
      10n,
      "test-upload:expiry-release",
    );
    expect(discardPlaceholder.execute).toHaveBeenCalledWith(driveItemId);
    expect(parts.deleteMany).toHaveBeenCalledWith({ uploadSessionId: sessionId });
  });

  it("aborts an upload and removes its incomplete placeholder", async () => {
    const driveItemId = new Types.ObjectId();
    const session = {
      _id: sessionId,
      ownerId,
      driveItemId,
      method: UploadMethod.SINGLE,
      status: UploadStatus.ABORTED,
      temporaryObjectKey: "objects/test/session",
      providerUploadId: null,
      declaredSizeBytes: 10n,
      idempotencyKey: "test-upload",
      errorCode: "ABORT_CLEANUP_PENDING",
    };
    const sessions = {
      findOneAndUpdate: jest.fn().mockResolvedValue(session),
      findOne: jest.fn(),
      updateOne: jest.fn(),
    };
    const parts = { deleteMany: jest.fn() };
    const storage = {
      abortMultipartUpload: jest.fn(),
      deleteObject: jest.fn(),
    };
    const quota = { release: jest.fn() };
    const discardPlaceholder = { execute: jest.fn() };
    const useCase = new AbortUploadUseCase(
      sessions as never,
      parts as never,
      storage as never,
      quota as never,
      discardPlaceholder as never,
    );

    await expect(useCase.execute(ownerId, sessionId)).resolves.toEqual({
      status: UploadStatus.ABORTED,
    });
    expect(storage.deleteObject).toHaveBeenCalledWith(session.temporaryObjectKey);
    expect(quota.release).toHaveBeenCalledWith(
      ownerId,
      10n,
      "test-upload:abort-release",
    );
    expect(discardPlaceholder.execute).toHaveBeenCalledWith(driveItemId);
    expect(parts.deleteMany).toHaveBeenCalledWith({ uploadSessionId: sessionId });
  });
});
