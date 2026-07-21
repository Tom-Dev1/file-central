import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type DriveItemDocument = HydratedDocument<DriveItem>;

export enum DriveItemType {
  FILE = 'file',
  FOLDER = 'folder',
}

@Schema({ timestamps: true })
export class DriveItem {
  _id: Types.ObjectId;

  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ required: true, enum: DriveItemType, index: true })
  type: DriveItemType;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  ownerId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'DriveItem', default: null, index: true })
  parentId: Types.ObjectId | null;

  // --- File-only fields ---
  @Prop()
  mimeType?: string;

  @Prop()
  size?: number;

  @Prop()
  bucket?: string;

  @Prop()
  objectKey?: string;

  @Prop()
  extension?: string;

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
