import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { Types } from "mongoose";
import { DriveItemsService } from "../drive-items/drive-items.service";
import { DriveItemType } from "../drive-items/schemas/drive-item.schema";
import { PermissionsService } from "../permissions/permissions.service";
import { SharePermission } from "../shares/schemas/share.schema";
import { RenameDto } from "./dto/rename.dto";
import { MoveDto } from "./dto/move.dto";
import { PaginatedResponseDto } from "../common/dto/paginated-response.dto";

@Injectable()
export class DriveService {
  private readonly logger = new Logger(DriveService.name);

  constructor(private driveItemsService: DriveItemsService, private permissionsService: PermissionsService) {}

  async list(userId: string, parentId: string | null, page: number, limit: number) {
    const filter = {
      ownerId: new Types.ObjectId(userId),
      parentId: parentId ? new Types.ObjectId(parentId) : null,
      isDeleted: false,
    };

    const [items, total] = await Promise.all([
      this.driveItemsService.model
        .find(filter)
        .sort({ type: -1, name: 1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      this.driveItemsService.model.countDocuments(filter),
    ]);

    return new PaginatedResponseDto(items, page, limit, total);
  }

  async search(userId: string, query: string, type: "file" | "folder" | undefined, page: number, limit: number) {
    const filter: any = {
      ownerId: new Types.ObjectId(userId),
      isDeleted: false,
      name: { $regex: query, $options: "i" },
    };
    if (type) filter.type = type;

    const [items, total] = await Promise.all([
      this.driveItemsService.model
        .find(filter)
        .sort({ updatedAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      this.driveItemsService.model.countDocuments(filter),
    ]);

    return new PaginatedResponseDto(items, page, limit, total);
  }
  async getById(userId: string, userEmail: string | undefined, itemId: string) {
    const objectId = new Types.ObjectId(itemId);
    await this.permissionsService.requireAccess(userId, userEmail, objectId, SharePermission.VIEW);

    const item = await this.driveItemsService.model.findOne({ _id: objectId, isDeleted: false });
    if (!item) throw new NotFoundException("Item not found");

    // Fire-and-forget: opening an item's detail counts as a view. A write
    // error here must not fail the GET response.
    this.driveItemsService.touchViewed(objectId).catch((err) => {
      this.logger.warn(`Failed to update lastViewedAt for ${objectId}: ${(err as Error).message}`);
    });

    return item;
  }

  async getAncestors(userId: string, userEmail: string | undefined, itemId: string) {
    const objectId = new Types.ObjectId(itemId);
    const access = await this.permissionsService.requireAccess(userId, userEmail, objectId, SharePermission.VIEW);

    const fullChain = await this.driveItemsService.getAncestorsIncludingSelf(objectId);
    if (access.isOwner) return fullChain;

    const chainIds = fullChain.map((item) => item._id);
    const entryPointId = await this.permissionsService.findShareEntryPoint(userId, userEmail, chainIds);
    // shouldn't happen given requireAccess already passed, but fail open to the full chain rather than an empty breadcrumb
    if (!entryPointId) return fullChain;

    const entryIndex = fullChain.findIndex((item) => item._id.equals(entryPointId));
    return entryIndex === -1 ? fullChain : fullChain.slice(entryIndex);
  }
  async rename(userId: string, userEmail: string | undefined, itemId: string, dto: RenameDto) {
    const objectId = new Types.ObjectId(itemId);
    await this.permissionsService.requireAccess(userId, userEmail, objectId, SharePermission.EDIT);

    const item = await this.driveItemsService.model.findOne({ _id: objectId, isDeleted: false });
    if (!item) throw new NotFoundException("Item not found");

    await this.driveItemsService.assertNoDuplicateName(item.ownerId.toString(), item.parentId, dto.name, item._id);

    item.name = dto.name;
    item.lastModifiedAt = new Date();
    await item.save();
    return item;
  }

  async move(userId: string, userEmail: string | undefined, itemId: string, dto: MoveDto) {
    const objectId = new Types.ObjectId(itemId);
    await this.permissionsService.requireAccess(userId, userEmail, objectId, SharePermission.EDIT);

    const item = await this.driveItemsService.model.findOne({ _id: objectId, isDeleted: false });
    if (!item) throw new NotFoundException("Item not found");

    if (item.type === DriveItemType.FOLDER) {
      await this.driveItemsService.assertNotCircularMove(
        item._id,
        dto.newParentId ? new Types.ObjectId(dto.newParentId) : null
      );
    }

    // Destination folder must belong to the same tree (the item's owner),
    // since MinIO/Mongo ownership is scoped per-owner regardless of who
    // is performing the move via a share.
    const newParentId = await this.driveItemsService.assertValidParent(item.ownerId.toString(), dto.newParentId);
    await this.driveItemsService.assertNoDuplicateName(item.ownerId.toString(), newParentId, item.name, item._id);

    item.parentId = newParentId;
    item.lastModifiedAt = new Date();
    await item.save();
    return item;
  }

  async remove(userId: string, userEmail: string | undefined, itemId: string) {
    const objectId = new Types.ObjectId(itemId);
    await this.permissionsService.requireAccess(userId, userEmail, objectId, SharePermission.EDIT);

    const deletedIds = await this.driveItemsService.softDeleteRecursive(objectId);
    if (deletedIds.length === 0) {
      throw new NotFoundException("Item not found");
    }
    return { deletedIds: deletedIds.map((id) => id.toString()) };
  }
}
