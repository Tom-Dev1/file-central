import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { DriveItemType } from '../../drive-items/domain/enums/drive-item.enum';

export type ShareDocument = HydratedDocument<Share>;
export enum SharePermission { VIEW = 'view', DOWNLOAD = 'download', EDIT = 'edit' }
export enum ShareType { USER = 'user', PUBLIC_LINK = 'public_link' }

@Schema({ collection: 'shares', timestamps: true, versionKey: false })
export class Share {
  declare _id: Types.ObjectId;
  @Prop({ type: Types.ObjectId, ref: 'DriveItem', required: true, index: true }) itemId!: Types.ObjectId;
  @Prop({ type: String, enum: DriveItemType, required: true }) itemType!: DriveItemType;
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true }) ownerId!: Types.ObjectId;
  @Prop({ type: Types.ObjectId, ref: 'User', default: null, index: true }) sharedWithUserId?: Types.ObjectId | null;
  @Prop({ type: String, default: null, lowercase: true, trim: true }) sharedWithEmail?: string | null;
  @Prop({ type: String, enum: SharePermission, required: true, default: SharePermission.VIEW }) permission!: SharePermission;
  @Prop({ type: String, enum: ShareType, required: true }) shareType!: ShareType;
  @Prop({ type: Buffer, default: null, select: false }) tokenHash?: Buffer | null;
  @Prop({ type: Date, default: null }) expiresAt?: Date | null;
  @Prop({ type: Boolean, default: false }) isRevoked!: boolean;
  createdAt!: Date;
  updatedAt!: Date;
}

export const ShareSchema = SchemaFactory.createForClass(Share);
ShareSchema.index({ sharedWithEmail: 1 });
ShareSchema.index({ tokenHash: 1 }, { unique: true, sparse: true });
ShareSchema.index({ itemId: 1, isRevoked: 1 });
