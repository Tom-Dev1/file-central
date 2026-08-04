import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument, Types, Schema as MongooseSchema } from "mongoose";
import { FileStatus } from "../enums/drive-item.enum";

export type DriveItemDocument = HydratedDocument<DriveItem>;

export enum DriveItemType {
  FILE = "file",
  FOLDER = "folder",
}
export const MAX_FOLDER_DEPTH = 64;

@Schema({
  collection: "drive_items",
  timestamps: true,
  versionKey: false,
  toJSON: {
    virtuals: true,
    transform(_doc, returnedObject) {
      const serialized = returnedObject as unknown as {
        _id?: Types.ObjectId;
        id?: string;
        normalizedName?: string;
        storageObjectId?: Types.ObjectId | null;
      };

      if (serialized._id) {
        serialized.id = serialized._id.toString();
      }

      delete serialized._id;
      delete serialized.normalizedName;
      delete serialized.storageObjectId;
    },
  },
})
export class DriveItem {
  _id: Types.ObjectId;

  @Prop({ type: String, required: true, trim: true, minlength: 1, maxLength: 255 })
  name: string;

  @Prop({ type: String, required: true, minlength: 1, maxlength: 255, select: false })
  normalizedName: string;

  @Prop({ required: true, enum: Object.values(DriveItemType), index: true })
  type: DriveItemType;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: "User", required: true, immutable: true })
  ownerId: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: "DriveItem", default: null })
  parentId: Types.ObjectId | null;

  @Prop({ type: [MongooseSchema.Types.ObjectId], default: [], required: true })
  ancestorIds: Types.ObjectId[];

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: "StorageObject", default: null })
  storageObjectId: Types.ObjectId | null;

  @Prop({ type: String, enum: Object.values(FileStatus), default: null })
  fileStatus: FileStatus | null;
  // --- File-only fields ---
  @Prop({ type: String, default: null, maxlength: 255 })
  mimeType: string | null;

  @Prop({
    type: Number,
    default: null,
    min: 0,
    max: Number.MAX_SAFE_INTEGER,
    validate: {
      validator: (value: number | null) => value === null || Number.isSafeInteger(value),
      message: "sizeBytes must be a non-negative safe integer.",
    },
  })
  sizeBytes: number | null;

  @Prop({
    type: String,
    default: null,
    lowercase: true,
    maxlength: 32,
    match: /^[a-z0-9]+(?:[._+-][a-z0-9]+)*$/i,
  })
  extension: string | null;

  @Prop({
    type: Number,
    default: null,
    min: 0,
    validate: {
      validator: (value: number | null) => value === null || Number.isSafeInteger(value),
      message: "childCount must be a non-negative safe integer.",
    },
  })
  childCount: number | null;

  @Prop({ type: Boolean, required: true, default: false })
  isTrashed: boolean;

  @Prop({ type: Date, default: null })
  trashedAt: Date | null;

  @Prop({
    type: Number,
    required: true,
    default: 1,
    min: 1,
    validate: {
      validator: Number.isSafeInteger,
      message: "metadataVersion must be a positive safe integer.",
    },
  })
  metadataVersion: number;

  @Prop({ type: Date, required: true, default: Date.now })
  lastModifiedAt: Date;

  createdAt: Date;
  updatedAt: Date;
  @Prop()
  bucket?: string;

  @Prop()
  objectKey?: string;

  @Prop({ default: false, index: true })
  isDeleted: boolean;

  @Prop({ type: Date, default: null })
  deletedAt?: Date | null;
}

export const DriveItemSchema = SchemaFactory.createForClass(DriveItem);

// Composite indexes to support the main query patterns:
// - listing children of a folder for a given owner
// - detecting duplicate names within the same parent
DriveItemSchema.index({ ownerId: 1, parentId: 1, isDeleted: 1 });
DriveItemSchema.index({ ownerId: 1, parentId: 1, name: 1 });
