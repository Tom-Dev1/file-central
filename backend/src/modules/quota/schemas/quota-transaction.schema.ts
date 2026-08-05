import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

export type QuotaTransactionDocument = HydratedDocument<QuotaTransaction>;
export enum QuotaTxType { RESERVE = 'reserve', COMMIT = 'commit', RELEASE = 'release', DELETE = 'delete' }

@Schema({ collection: 'quota_transactions', versionKey: false })
export class QuotaTransaction {
  declare _id: Types.ObjectId;
  @Prop({ type: MongooseSchema.Types.ObjectId, required: true }) userId!: Types.ObjectId;
  @Prop({ type: MongooseSchema.Types.ObjectId, default: null }) uploadSessionId!: Types.ObjectId | null;
  @Prop({ type: MongooseSchema.Types.ObjectId, default: null }) driveItemId!: Types.ObjectId | null;
  @Prop({ type: String, enum: QuotaTxType, required: true }) type!: QuotaTxType;
  @Prop({ type: MongooseSchema.Types.BigInt, required: true, min: 0 }) bytes!: bigint;
  @Prop({ type: String, required: true }) idempotencyKey!: string;
  createdAt!: Date;
}

export const QuotaTransactionSchema = SchemaFactory.createForClass(QuotaTransaction);
QuotaTransactionSchema.set('timestamps', { createdAt: true, updatedAt: false });
QuotaTransactionSchema.index({ idempotencyKey: 1 }, { unique: true });
QuotaTransactionSchema.index({ userId: 1, createdAt: -1, _id: -1 });
