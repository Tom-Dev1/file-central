import { Injectable } from "@nestjs/common";
import { Types } from "mongoose";
import { DriveItemType } from "../../../domain/enums/drive-item.enum";
import { DriveItemNamePolicy } from "../../../domain/policies/drive-item-name.policy";
import { DriveItemRepository } from "../../../infrastructure/repositories/drive-item.repository";
import { DriveItemChildCountService } from "../../services/drive-item-child-count.service";
import { DriveItemParentService } from "../../services/drive-item-parent.service";

@Injectable()
export class CreateFolderCommand {
  constructor(
    private readonly items: DriveItemRepository,
    private readonly names: DriveItemNamePolicy,
    private readonly parents: DriveItemParentService,
    private readonly childCounts: DriveItemChildCountService,
  ) {}

  async execute(args: { ownerId: Types.ObjectId; parentId: Types.ObjectId | null; name: string }) {
    const ancestorIds = await this.parents.resolveAncestors(args.ownerId, args.parentId);
    try {
      const folder = await this.items.model.create({
        ...args,
        ancestorIds,
        normalizedName: this.names.normalize(args.name),
        type: DriveItemType.FOLDER,
        storageObjectId: null,
        fileStatus: null,
        mimeType: null,
        sizeBytes: null,
        extension: null,
        childCount: 0,
      });
      await this.childCounts.adjust(args.parentId, 1);
      return folder;
    } catch (error) {
      this.names.rethrowDuplicate(error);
    }
  }
}
