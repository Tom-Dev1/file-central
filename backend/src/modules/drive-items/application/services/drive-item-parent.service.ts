import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Types } from "mongoose";
import { MAX_FOLDER_DEPTH } from "../../domain/constants/drive-item.constants";
import { DriveItemType } from "../../domain/enums/drive-item.enum";
import { DriveItemRepository } from "../../infrastructure/repositories/drive-item.repository";

@Injectable()
export class DriveItemParentService {
  constructor(private readonly items: DriveItemRepository) {}

  async resolveAncestors(ownerId: Types.ObjectId, parentId: Types.ObjectId | null): Promise<Types.ObjectId[]> {
    if (!parentId) return [];
    const parent = await this.items.model.findOne({
      _id: parentId,
      ownerId,
      type: DriveItemType.FOLDER,
      isTrashed: false,
    }).lean();
    if (!parent) throw new NotFoundException("PARENT_NOT_FOUND");
    const ancestors = [...parent.ancestorIds, parent._id];
    if (ancestors.length > MAX_FOLDER_DEPTH) throw new BadRequestException("MAX_DEPTH_EXCEEDED");
    return ancestors;
  }

  async validate(ownerId: string, parentId?: string | null): Promise<Types.ObjectId | null> {
    const id = parentId ? new Types.ObjectId(parentId) : null;
    await this.resolveAncestors(new Types.ObjectId(ownerId), id);
    return id;
  }
}
