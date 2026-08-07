import { ConflictException, Injectable } from "@nestjs/common";
import { Types } from "mongoose";
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
    const filter: Record<string, unknown> = {
      ownerId,
      parentId,
      normalizedName: this.names.normalize(name),
      isTrashed: false,
    };
    if (excludeId) filter._id = { $ne: excludeId };
    if (await this.items.model.exists(filter)) throw new ConflictException("NAME_ALREADY_EXISTS");
  }
}
