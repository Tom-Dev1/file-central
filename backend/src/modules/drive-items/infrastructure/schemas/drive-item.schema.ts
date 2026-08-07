import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';
import { DriveItemType, FileStatus } from '../../domain/enums/drive-item.enum';

export type DriveItemDocument = HydratedDocument<DriveItem>;

@Schema({ collection: 'drive_items', timestamps: true, versionKey: false })
export class DriveItem {
  declare _id: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true, immutable: true, index: true })
  ownerId!: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'DriveItem', default: null })
  parentId!: Types.ObjectId | null;

  @Prop({ type: [MongooseSchema.Types.ObjectId], default: [], required: true })
  ancestorIds!: Types.ObjectId[];

  @Prop({ type: String, required: true, trim: true, minlength: 1, maxlength: 255 })
  name!: string;

  @Prop({ type: String, required: true, minlength: 1, maxlength: 255, select: false })
  normalizedName!: string;

  @Prop({ type: String, enum: DriveItemType, required: true, index: true })
  type!: DriveItemType;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'StorageObject', default: null })
  storageObjectId!: Types.ObjectId | null;

  @Prop({ type: String, enum: FileStatus, default: null })
  fileStatus!: FileStatus | null;

  @Prop({ type: String, default: null, maxlength: 255 })
  mimeType!: string | null;

  @Prop({ type: MongooseSchema.Types.BigInt, default: null, min: 0 })
  sizeBytes!: bigint | null;

  @Prop({ type: String, default: null, lowercase: true, maxlength: 32 })
  extension!: string | null;

  @Prop({ type: Number, default: null, min: 0 })
  childCount!: number | null;

  @Prop({ type: Boolean, required: true, default: false })
  isTrashed!: boolean;

  @Prop({ type: Date, default: null })
  trashedAt!: Date | null;

  @Prop({ type: MongooseSchema.Types.ObjectId, default: null })
  trashedRootId!: Types.ObjectId | null;

  @Prop({ type: Number, required: true, default: 1, min: 1 })
  metadataVersion!: number;

  @Prop({ type: Date, required: true, default: Date.now })
  lastModifiedAt!: Date;

  createdAt!: Date;
  updatedAt!: Date;
}

export const DriveItemSchema = SchemaFactory.createForClass(DriveItem);
DriveItemSchema.index({ ownerId: 1, parentId: 1, isTrashed: 1, lastModifiedAt: -1, _id: -1 });
DriveItemSchema.index({ ownerId: 1, parentId: 1, isTrashed: 1, type: -1, normalizedName: 1, _id: 1 });
DriveItemSchema.index(
  { ownerId: 1, parentId: 1, normalizedName: 1 },
  { unique: true, partialFilterExpression: { isTrashed: false } },
);
DriveItemSchema.index({ ownerId: 1, ancestorIds: 1, isTrashed: 1 });
DriveItemSchema.index({ ownerId: 1, isTrashed: 1, trashedAt: -1, _id: -1 });
DriveItemSchema.index({ ownerId: 1, fileStatus: 1, createdAt: 1 });
