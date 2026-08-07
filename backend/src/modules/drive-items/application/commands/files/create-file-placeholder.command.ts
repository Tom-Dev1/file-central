import { ConflictException, Injectable } from "@nestjs/common";
import { Types } from "mongoose";
import { MAX_COPY_NAME_ATTEMPTS } from "../../../domain/constants/drive-item.constants";
import { DriveItemType, FileStatus } from "../../../domain/enums/drive-item.enum";
import { DriveItemNamePolicy } from "../../../domain/policies/drive-item-name.policy";
import { DriveItemRepository } from "../../../infrastructure/repositories/drive-item.repository";
import { DriveItemParentService } from "../../services/drive-item-parent.service";

@Injectable()
export class CreateFilePlaceholderCommand {
  constructor(
    private readonly items: DriveItemRepository,
    private readonly names: DriveItemNamePolicy,
    private readonly parents: DriveItemParentService,
  ) {}

  async execute(args: { ownerId: Types.ObjectId; parentId: Types.ObjectId | null; name: string }): Promise<{ id: Types.ObjectId; name: string }> {
    const ancestorIds = await this.parents.resolveAncestors(args.ownerId, args.parentId);
    for (let copyNumber = 0; copyNumber < MAX_COPY_NAME_ATTEMPTS; copyNumber++) {
      const name = this.names.createCopyName(args.name, copyNumber);
      try {
        const item = await this.items.model.create({
          ...args,
          name,
          ancestorIds,
          normalizedName: this.names.normalize(name),
          type: DriveItemType.FILE,
          storageObjectId: null,
          fileStatus: FileStatus.UPLOADING,
          mimeType: null,
          sizeBytes: null,
          extension: this.names.extractExtension(name),
          childCount: null,
        });
        return { id: item._id, name: item.name };
      } catch (error) {
        if (!this.names.isDuplicateKeyError(error)) throw error;
      }
    }
    throw new ConflictException("NAME_GENERATION_EXHAUSTED");
  }
}
