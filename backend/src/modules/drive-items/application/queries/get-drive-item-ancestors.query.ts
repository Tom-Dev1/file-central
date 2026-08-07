import { Injectable } from "@nestjs/common";
import { Types } from "mongoose";
import { DriveItemRepository } from "../../infrastructure/repositories/drive-item.repository";

@Injectable()
export class GetDriveItemAncestorsQuery {
  constructor(private readonly items: DriveItemRepository) {}

  async execute(itemId: Types.ObjectId) {
    const item = await this.items.model.findOne({ _id: itemId, isTrashed: false }).lean();
    if (!item) return [];
    const ancestors = item.ancestorIds.length
      ? await this.items.model.find({ _id: { $in: item.ancestorIds }, isTrashed: false }).lean()
      : [];
    const byId = new Map(ancestors.map((ancestor) => [ancestor._id.toString(), ancestor]));
    return [
      ...item.ancestorIds.map((id) => byId.get(id.toString())).filter(
        (value): value is NonNullable<typeof value> => Boolean(value),
      ),
      item,
    ];
  }
}
