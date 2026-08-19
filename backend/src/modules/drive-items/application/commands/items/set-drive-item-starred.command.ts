import { Injectable, NotFoundException } from "@nestjs/common";
import { Types } from "mongoose";
import { DriveItemRepository } from "../../../infrastructure/repositories/drive-item.repository";

@Injectable()
export class SetDriveItemStarredCommand {
  constructor(private readonly items: DriveItemRepository) {}

  async execute(args: {
    ownerId: Types.ObjectId;
    itemId: Types.ObjectId;
    isStarred: boolean;
  }) {
    const item = await this.items.model
      .findOneAndUpdate(
        {
          _id: args.itemId,
          ownerId: args.ownerId,
          isTrashed: false,
        },
        { $set: { isStarred: args.isStarred } },
        { returnDocument: "after" },
      )
      .lean();

    if (!item) {
      throw new NotFoundException("DRIVE_ITEM_NOT_FOUND");
    }

    return item;
  }
}
