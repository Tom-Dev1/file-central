import { ConflictException, Injectable } from "@nestjs/common";
import { Types } from "mongoose";
import { DriveItemRepository } from "../../infrastructure/repositories/drive-item.repository";

interface RestorableItem {
  _id: Types.ObjectId;
  parentId: Types.ObjectId | null;
  normalizedName: string;
}

@Injectable()
export class RestoreNameAvailabilityService {
  constructor(private readonly items: DriveItemRepository) {}

  async assertAvailable(ownerId: Types.ObjectId, docs: RestorableItem[]): Promise<void> {
    const restoredIds = docs.map((item) => item._id);
    const parentIds = [...new Map(
      docs.map((item) => [item.parentId?.toString() ?? "root", item.parentId]),
    ).values()];
    const activeSiblings = await this.items.model.find({
      ownerId,
      parentId: { $in: parentIds },
      isTrashed: false,
      _id: { $nin: restoredIds },
    }).select("parentId normalizedName").lean();
    const occupied = new Set(activeSiblings.map(
      (item) => `${item.parentId?.toString() ?? "root"}:${item.normalizedName}`,
    ));
    if (docs.some((item) => occupied.has(
      `${item.parentId?.toString() ?? "root"}:${item.normalizedName}`,
    ))) throw new ConflictException("RESTORE_NAME_COLLISION");
  }
}
