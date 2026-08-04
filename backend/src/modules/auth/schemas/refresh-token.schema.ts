import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument, Types } from "mongoose";

export type RefreshTokenDocument = HydratedDocument<RefreshToken>;

@Schema({ timestamps: true })
export class RefreshToken {
  _id!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: "User", required: true, index: true })
  userId!: Types.ObjectId;

  @Prop({ type: String, required: true, unique: true, index: true })
  tokenHash!: string;

  @Prop({ type: Date, required: true })
  expiresAt!: Date;

  @Prop({ default: false })
  isRevoked!: boolean;
}

export const RefreshTokenSchema = SchemaFactory.createForClass(RefreshToken);

// TTL index: MongoDB automatically deletes the document once `expiresAt`
// is in the past, so expired sessions are cleaned up without a cron job.
RefreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
