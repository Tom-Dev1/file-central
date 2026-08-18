import { ConflictException, Injectable } from "@nestjs/common";
import { Types } from "mongoose";
import { DriveItemType } from "../../../domain/enums/drive-item.enum";
import { DriveItemNamePolicy } from "../../../domain/policies/drive-item-name.policy";
import { DriveItemRepository } from "../../../infrastructure/repositories/drive-item.repository";
import { DriveItemChildCountService } from "../../services/drive-item-child-count.service";
import { DriveItemNameAvailabilityService } from "../../services/drive-item-name-availability.service";
import { DriveItemParentService } from "../../services/drive-item-parent.service";

const MAX_UNIQUE_CONSTRAINT_RETRIES = 3;

@Injectable()
export class CreateFolderCommand {
  constructor(
    private readonly items: DriveItemRepository,
    private readonly names: DriveItemNamePolicy,
    private readonly parents: DriveItemParentService,
    private readonly childCounts: DriveItemChildCountService,
    private readonly availability: DriveItemNameAvailabilityService,
  ) {}

  async execute(args: { ownerId: Types.ObjectId; parentId: Types.ObjectId | null; name: string }) {
    const ancestorIds = await this.parents.resolveAncestors(args.ownerId, args.parentId);
    for (let attempt = 0; attempt < MAX_UNIQUE_CONSTRAINT_RETRIES; attempt++) {
      const name = await this.availability.generateAvailableName(
        args.ownerId,
        args.parentId,
        args.name,
      );

      try {
        const folder = await this.items.model.create({
          ...args,
          name,
          ancestorIds,
          normalizedName: this.names.normalize(name),
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
        if (!this.names.isDuplicateKeyError(error)) throw error;
      }
    }

    throw new ConflictException("NAME_GENERATION_EXHAUSTED");
  }
}
