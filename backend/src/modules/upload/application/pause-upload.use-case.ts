import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import { UploadSession, UploadStatus } from "../schemas/upload-session.schema";

@Injectable()
export class PauseUploadUseCase {
  constructor(
    @InjectModel(UploadSession.name)
    private readonly sessions: Model<UploadSession>,
  ) {}

  async execute(ownerId: Types.ObjectId, sessionId: Types.ObjectId) {
    const session = await this.sessions.findOneAndUpdate(
      {
        _id: sessionId,
        ownerId,
        status: { $in: [UploadStatus.PENDING, UploadStatus.UPLOADED] },
        expiresAt: { $gt: new Date() },
      },
      { $set: { status: UploadStatus.PAUSED } },
      { returnDocument: "after" },
    );
    if (session) return { status: session.status };

    const current = await this.sessions.findOne({ _id: sessionId, ownerId });
    if (!current) throw new NotFoundException("UPLOAD_SESSION_NOT_FOUND");
    if (current.expiresAt.getTime() <= Date.now()) {
      throw new ConflictException("UPLOAD_SESSION_EXPIRED");
    }
    if (current.status === UploadStatus.COMPLETED) {
      throw new ConflictException("Cannot pause a completed upload");
    }
    if (
      [UploadStatus.ABORTED, UploadStatus.EXPIRED, UploadStatus.FAILED].includes(
        current.status,
      ) ||
      current.status === UploadStatus.PAUSED
    ) {
      return { status: current.status };
    }
    throw new ConflictException(
      `Cannot pause session in status ${current.status}`,
    );
  }
}
