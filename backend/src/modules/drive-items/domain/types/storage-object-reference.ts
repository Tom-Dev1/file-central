import { Types } from "mongoose";

export interface StorageObjectReference {
  storageObjectId: Types.ObjectId;
  ownerId: Types.ObjectId;
  sizeBytes: bigint;
}
