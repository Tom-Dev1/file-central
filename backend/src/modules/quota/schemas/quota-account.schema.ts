import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

export type QuotaAccountDocument = HydratedDocument<QuotaAccount>;

@Schema({ collection: 'quota_accounts', versionKey: false })
export class QuotaAccount {
  declare _id: Types.ObjectId;
  @Prop({ type: MongooseSchema.Types.ObjectId, required: true }) userId!: Types.ObjectId;
  @Prop({ type: MongooseSchema.Types.BigInt, required: true, min: 0 }) quotaBytes!: bigint;
  @Prop({ type: MongooseSchema.Types.BigInt, required: true, default: 0n, min: 0 }) usedBytes!: bigint;
  @Prop({ type: MongooseSchema.Types.BigInt, required: true, default: 0n, min: 0 }) reservedBytes!: bigint;
  updatedAt!: Date;
}

export const QuotaAccountSchema = SchemaFactory.createForClass(QuotaAccount);
QuotaAccountSchema.set('timestamps', { createdAt: false, updatedAt: true });
QuotaAccountSchema.index({ userId: 1 }, { unique: true });
