import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument, Schema as MongooseSchema, Types } from "mongoose";

export type UploadSessionDocument = HydratedDocument<UploadSession>;

export enum UploadMethod {
  SINGLE = "single",
  MULTIPART = "multipart",
}

export enum UploadStatus {
  PENDING = "pending",
  PAUSED = "paused",
  UPLOADED = "uploaded",
  PROCESSING = "processing",
  COMPLETED = "completed",
  ABORTED = "aborted",
  EXPIRED = "expired",
  FAILED = "failed",
}

@Schema({ collection: "upload_sessions", versionKey: false })
export class UploadSession {
  declare _id: Types.ObjectId;

  @Prop({ type: Types.ObjectId, required: true, index: true })
  ownerId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, required: true })
  driveItemId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, default: null })
  parentId: Types.ObjectId | null;

  @Prop({ type: String, default: null })
  originalName: string | null;

  @Prop({ type: String, enum: UploadMethod, required: true })
  method: UploadMethod;

  @Prop({ type: String, default: null })
  providerUploadId: string | null;

  @Prop({ type: String, required: true })
  temporaryObjectKey: string;

  @Prop({ type: Number, default: null, min: 1 })
  partSizeBytes: number | null;

  @Prop({ type: Number, default: null, min: 1, max: 9000 })
  expectedPartsCount: number | null;

  @Prop({ type: MongooseSchema.Types.BigInt, required: true, min: 0 })
  declaredSizeBytes: bigint;

  @Prop({ type: MongooseSchema.Types.BigInt, default: null, min: 0 })
  actualSizeBytes: bigint | null;

  @Prop({ type: Buffer, default: null })
  declaredChecksumSha256: Buffer | null;

  @Prop({ type: Buffer, default: null })
  verifiedChecksumSha256: Buffer | null;

  @Prop({
    type: String,
    enum: UploadStatus,
    default: UploadStatus.PENDING,
    index: true,
  })
  status: UploadStatus;

  @Prop({ type: String, default: null })
  idempotencyKey: string | null;

  @Prop({ type: String, default: null })
  errorCode: string | null;

  @Prop({ type: Date, required: true, index: true })
  expiresAt: Date;

  createdAt: Date;
  updatedAt: Date;
}

export const UploadSessionSchema = SchemaFactory.createForClass(UploadSession);

UploadSessionSchema.set("timestamps", true);

UploadSessionSchema.index({ ownerId: 1, status: 1, createdAt: -1, _id: -1 });
UploadSessionSchema.index({ status: 1, expiresAt: 1, _id: 1 });
UploadSessionSchema.index(
  { ownerId: 1, idempotencyKey: 1 },
  {
    unique: true,
    partialFilterExpression: { idempotencyKey: { $type: "string" } },
  }
);
// The reaper must observe expired sessions before archival cleanup so it can
// abort multipart uploads and release reserved quota.
