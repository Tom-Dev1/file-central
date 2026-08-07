import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import { S3StorageAdapter } from "../../s3/s3-storage.adapter";
import { UploadPart } from "../schemas/upload-part.schema";
import {
  UploadMethod,
  UploadSession,
  UploadStatus,
} from "../schemas/upload-session.schema";

@Injectable()
export class GetUploadStatusUseCase {
  constructor(
    @InjectModel(UploadSession.name)
    private readonly sessions: Model<UploadSession>,
    @InjectModel(UploadPart.name)
    private readonly parts: Model<UploadPart>,
    private readonly storage: S3StorageAdapter,
  ) {}

  async execute(ownerId: Types.ObjectId, sessionId: Types.ObjectId) {
    const session = await this.sessions.findOne({ _id: sessionId, ownerId });
    if (!session) throw new NotFoundException("UPLOAD_SESSION_NOT_FOUND");
    if (session.expiresAt.getTime() <= Date.now()) {
      throw new ConflictException("UPLOAD_SESSION_EXPIRED");
    }
    if (session.status === UploadStatus.COMPLETED) {
      return { status: session.status, driveItemId: session.driveItemId };
    }
    if (session.status === UploadStatus.PAUSED) {
      session.status = UploadStatus.PENDING;
      await session.save();
    }
    if (
      [UploadStatus.ABORTED, UploadStatus.EXPIRED, UploadStatus.FAILED].includes(
        session.status,
      )
    ) {
      throw new ConflictException(
        `UPLOAD_SESSION_NOT_RESUMABLE:${session.status}`,
      );
    }
    if (session.method === UploadMethod.SINGLE) {
      const head = await this.storage.headObject(session.temporaryObjectKey);
      return { status: session.status, singlePartUploaded: head !== null };
    }

    const remoteParts = await this.storage.listParts(
      session.temporaryObjectKey,
      session.providerUploadId!,
    );
    if (remoteParts.length > 0) {
      await this.parts.bulkWrite(
        remoteParts.map((part) => ({
          updateOne: {
            filter: {
              uploadSessionId: session._id,
              partNumber: part.partNumber,
            },
            update: {
              $set: {
                etag: part.etag,
                sizeBytes: BigInt(part.sizeBytes),
              },
            },
          },
        })),
        { ordered: false },
      );
    }
    const localParts = await this.parts
      .find({ uploadSessionId: session._id })
      .sort({ partNumber: 1 })
      .lean();
    const remoteNumbers = new Set(remoteParts.map((part) => part.partNumber));
    const missingPartUrls = await Promise.all(
      localParts
        .filter((part) => !remoteNumbers.has(part.partNumber))
        .map(async (part) => ({
          partNumber: part.partNumber,
          url: await this.storage.getPresignedPartUrl(
            session.temporaryObjectKey,
            session.providerUploadId!,
            part.partNumber,
          ),
        })),
    );
    return {
      status: session.status,
      totalParts: localParts.length,
      uploadedPartCount: remoteParts.length,
      uploadedParts: remoteParts
        .map((part) => ({
          partNumber: part.partNumber,
          etag: part.etag,
          sizeBytes: String(part.sizeBytes),
        }))
        .sort((left, right) => left.partNumber - right.partNumber),
      missingPartUrls,
    };
  }
}
