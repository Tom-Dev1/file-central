import { Injectable } from "@nestjs/common";
import { Types } from "mongoose";
import { DriveItemRepository } from "../../infrastructure/repositories/drive-item.repository";

@Injectable()
export class ListTrashRootsQuery {
  constructor(private readonly items: DriveItemRepository) {}

  execute(ownerId: string) {
    return this.items.model.find({
      ownerId: new Types.ObjectId(ownerId),
      isTrashed: true,
      $expr: { $eq: ["$_id", "$trashedRootId"] },
    }).sort({ trashedAt: -1, _id: -1 }).lean();
  }
}
