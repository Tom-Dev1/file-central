import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

export type UploadPartDocument = HydratedDocument<UploadPart>;

@Schema({ collection: 'upload_parts', versionKey: false })
export class UploadPart {
    _id: Types.ObjectId;
    @Prop({ type: Types.ObjectId, required: true, index: true })
    uploadSessionId: Types.ObjectId;

    @Prop({ type: Number, required: true })
    partNumber: number;

    @Prop({ type: String, default: null })
    etag: string | null;

    @Prop({ type: MongooseSchema.Types.BigInt, default: null, min: 0 })
    sizeBytes: bigint | null;

    createdAt: Date;
}

export const UploadPartSchema = SchemaFactory.createForClass(UploadPart);
UploadPartSchema.set('timestamps', { createdAt: true, updatedAt: false });
UploadPartSchema.index(
    { uploadSessionId: 1, partNumber: 1 },
    { unique: true },
);
