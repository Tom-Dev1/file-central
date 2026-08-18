import { ConflictException, Injectable } from "@nestjs/common";
import { Types } from "mongoose";
import { MAX_COPY_NAME_ATTEMPTS } from "../../domain/constants/drive-item.constants";
import { DriveItemNamePolicy } from "../../domain/policies/drive-item-name.policy";
import { DriveItemRepository } from "../../infrastructure/repositories/drive-item.repository";

@Injectable()
export class DriveItemNameAvailabilityService {
  constructor(
    private readonly items: DriveItemRepository,
    private readonly names: DriveItemNamePolicy,
  ) {}

  async assertAvailable(
    ownerId: Types.ObjectId,
    parentId: Types.ObjectId | null,
    name: string,
    excludeId?: Types.ObjectId,
  ): Promise<void> {
    if (await this.existsByName(ownerId, parentId, name, excludeId)) {
      throw new ConflictException("NAME_ALREADY_EXISTS");
    }
  }

  async generateAvailableName(
    ownerId: Types.ObjectId,
    parentId: Types.ObjectId | null,
    baseName: string,
  ): Promise<string> {
    for (let copyNumber = 0; copyNumber < MAX_COPY_NAME_ATTEMPTS; copyNumber++) {
      const name = this.names.createFolderCopyName(baseName, copyNumber);
      if (!(await this.existsByName(ownerId, parentId, name))) return name;
    }

    throw new ConflictException("NAME_GENERATION_EXHAUSTED");
  }

  private async existsByName(
    ownerId: Types.ObjectId,
    parentId: Types.ObjectId | null,
    name: string,
    excludeId?: Types.ObjectId,
  ): Promise<boolean> {
    const filter: Record<string, unknown> = {
      ownerId,
      parentId,
      normalizedName: this.names.normalize(name),
      isTrashed: false,
    };
    if (excludeId) filter._id = { $ne: excludeId };
    return Boolean(await this.items.model.exists(filter));
  }
}
