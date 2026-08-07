import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument, Schema as MongooseSchema, Types } from "mongoose";
import { StorageObjectState, StorageProvider, StorageScanStatus } from "../enums/storage-object.enum";

export type StorageObjectDocument = HydratedDocument<StorageObjectDoc>;

@Schema({
  collection: "storage_objects",
  timestamps: true,
  versionKey: false,
})
export class StorageObjectDoc {
  declare _id: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: "User", required: true, immutable: true })
  ownerId: Types.ObjectId;

  @Prop({ type: String, enum: Object.values(StorageProvider), required: true, immutable: true })
  provider: StorageProvider;

  @Prop({ type: String, required: true, immutable: true, trim: true, minlength: 1, maxlength: 255 })
  bucket: string;

  @Prop({ type: String, required: true })
  objectKey: string;

  @Prop({ type: MongooseSchema.Types.BigInt, required: true })
  sizeBytes: bigint;

  @Prop({
    type: String,
    required: false,
    default: null,
  })
  mimeType: string;

  @Prop({
    type: Buffer,
    required: false,
    default: null,
    immutable: true,
    validate: {
      validator: (value: Buffer | null): boolean => value === null || value.length === 32,
      message: "checksumSha256 must contain exactly 32 bytes",
    },
  })
  checksumSha256: Buffer | null;

  @Prop({
    type: String,
    enum: Object.values(StorageScanStatus),
    required: true,
    default: StorageScanStatus.NOT_REQUESTED,
  })
  scanStatus: StorageScanStatus;

  @Prop({
    type: String,
    enum: Object.values(StorageObjectState),
    required: true,
    default: StorageObjectState.ACTIVE,
  })
  state: StorageObjectState;

  createdAt: Date;
  updatedAt: Date;
}

export const StorageObjectSchema = SchemaFactory.createForClass(StorageObjectDoc);

StorageObjectSchema.index({ provider: 1, bucket: 1, objectKey: 1 }, { unique: true });

StorageObjectSchema.index({ ownerId: 1, createdAt: -1, _id: -1 }, { name: "storage_objects_by_owner" });

StorageObjectSchema.index({ state: 1, updatedAt: 1, _id: 1 }, { name: "storage_object_cleanup_queue" });

StorageObjectSchema.index({ scanStatus: 1, createdAt: 1, _id: 1 }, { name: "storage_object_scan_queue" });
