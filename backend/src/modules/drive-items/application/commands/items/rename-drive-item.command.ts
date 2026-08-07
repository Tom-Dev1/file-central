import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { Types } from "mongoose";
import { DriveItemType } from "../../../domain/enums/drive-item.enum";
import { DriveItemNamePolicy } from "../../../domain/policies/drive-item-name.policy";
import { DriveItemRepository } from "../../../infrastructure/repositories/drive-item.repository";

@Injectable()
export class RenameDriveItemCommand {
  constructor(
    private readonly items: DriveItemRepository,
    private readonly names: DriveItemNamePolicy,
  ) {}

  async execute(args: {
    ownerId: Types.ObjectId;
    itemId: Types.ObjectId;
    name: string;
    expectedMetadataVersion: number;
  }) {
    const current = await this.items.model.findOne({
      _id: args.itemId,
      ownerId: args.ownerId,
      isTrashed: false,
    }).lean();
    if (!current) throw new NotFoundException("DRIVE_ITEM_NOT_FOUND");
    try {
      const updated = await this.items.model.findOneAndUpdate(
        { _id: args.itemId, ownerId: args.ownerId, metadataVersion: args.expectedMetadataVersion, isTrashed: false },
        { $set: {
          name: args.name,
          normalizedName: this.names.normalize(args.name),
          extension: current.type === DriveItemType.FILE ? this.names.extractExtension(args.name) : null,
          lastModifiedAt: new Date(),
        }, $inc: { metadataVersion: 1 } },
        { returnDocument: "after" },
      );
      if (!updated) throw new ConflictException("DRIVE_ITEM_VERSION_CONFLICT");
      return updated;
    } catch (error) {
      this.names.rethrowDuplicate(error);
    }
  }
}
