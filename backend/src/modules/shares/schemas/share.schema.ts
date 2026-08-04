import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument, Types } from "mongoose";
import { DriveItemType } from "../../drive-items/schemas/drive-item.schema";

export type ShareDocument = HydratedDocument<Share>;

export enum SharePermission {
  VIEW = "view",
  DOWNLOAD = "download",
  EDIT = "edit",
}

export enum ShareType {
  USER = "user",
  PUBLIC_LINK = "public_link",
}

@Schema({ timestamps: true })
export class Share {
  _id: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: "DriveItem", required: true, index: true })
  itemId: Types.ObjectId;

  @Prop({ required: true, enum: DriveItemType })
  itemType: DriveItemType;

  @Prop({ type: Types.ObjectId, ref: "User", required: true, index: true })
  ownerId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: "User", default: null, index: true })
  sharedWithUserId?: Types.ObjectId | null;

  @Prop({ type: String, default: null, lowercase: true, trim: true })
  sharedWithEmail?: string | null;

  @Prop({ required: true, enum: SharePermission, default: SharePermission.VIEW })
  permission: SharePermission;

  @Prop({ required: true, enum: ShareType })
  shareType: ShareType;

  @Prop({ type: String, default: null, unique: true, sparse: true, index: true })
  token?: string | null;

  @Prop({ type: Date, default: null })
  expiresAt?: Date | null;

  @Prop({ default: false })
  isRevoked: boolean;
}

export const ShareSchema = SchemaFactory.createForClass(Share);

// itemId, ownerId, sharedWithUserId, and token already get an index via
// `index: true` on their @Prop() above; only sharedWithEmail needs one
// declared separately here.
ShareSchema.index({ sharedWithEmail: 1 });
