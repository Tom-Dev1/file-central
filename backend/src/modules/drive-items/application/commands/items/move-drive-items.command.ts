import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { Types } from "mongoose";

import { DriveItemNamePolicy } from "../../../domain/policies/drive-item-name.policy";
import { DriveItemRepository } from "../../../infrastructure/repositories/drive-item.repository";
import { DriveItemNameAvailabilityService } from "../../services/drive-item-name-availability.service";
import { DriveItemParentService } from "../../services/drive-item-parent.service";
import { MoveDriveItemCommand } from "./move-drive-item.command";

interface BulkMoveItemInput {
  itemId: Types.ObjectId;
  expectedMetadataVersion: number;
}

@Injectable()
export class MoveDriveItemsCommand {
  constructor(
    private readonly items: DriveItemRepository,
    private readonly names: DriveItemNamePolicy,
    private readonly availability: DriveItemNameAvailabilityService,
    private readonly parents: DriveItemParentService,
    private readonly moveItem: MoveDriveItemCommand,
  ) {}

  async execute(args: {
    items: BulkMoveItemInput[];
    newParentId: Types.ObjectId | null;
  }): Promise<Types.ObjectId[]> {
    const requestById = new Map<string, BulkMoveItemInput>();
    for (const item of args.items) {
      const key = item.itemId.toString();
      const existing = requestById.get(key);
      if (existing && existing.expectedMetadataVersion !== item.expectedMetadataVersion) {
        throw new BadRequestException("DUPLICATE_ITEM_VERSION_MISMATCH");
      }
      requestById.set(key, item);
    }

    const requestedItems = Array.from(requestById.values());
    if (!requestedItems.length) return [];

    const candidates = await this.items.model
      .find({
        _id: { $in: requestedItems.map((item) => item.itemId) },
        isTrashed: false,
      })
      .select("_id ownerId parentId ancestorIds name metadataVersion")
      .lean();

    if (candidates.length !== requestedItems.length) {
      throw new NotFoundException("DRIVE_ITEM_NOT_FOUND");
    }

    for (const candidate of candidates) {
      const request = requestById.get(candidate._id.toString());
      if (!request || candidate.metadataVersion !== request.expectedMetadataVersion) {
        throw new ConflictException("DRIVE_ITEM_VERSION_CONFLICT");
      }
    }

    const selectedIds = new Set(candidates.map((item) => item._id.toString()));
    const roots = candidates.filter(
      (item) => !item.ancestorIds.some((ancestorId) => selectedIds.has(ancestorId.toString())),
    );

    const normalizedNames = new Set<string>();
    for (const root of roots) {
      const nameKey = `${root.ownerId}:${this.names.normalize(root.name)}`;
      if (normalizedNames.has(nameKey)) {
        throw new ConflictException("NAME_ALREADY_EXISTS");
      }
      normalizedNames.add(nameKey);
    }

    const ancestorsByOwner = new Map<string, Types.ObjectId[]>();
    for (const root of roots) {
      const ownerKey = root.ownerId.toString();
      let newAncestors = ancestorsByOwner.get(ownerKey);
      if (!newAncestors) {
        newAncestors = await this.parents.resolveAncestors(root.ownerId, args.newParentId);
        ancestorsByOwner.set(ownerKey, newAncestors);
      }

      if (args.newParentId?.equals(root._id)) {
        throw new BadRequestException("CANNOT_MOVE_INTO_ITSELF");
      }
      if (newAncestors.some((ancestorId) => ancestorId.equals(root._id))) {
        throw new BadRequestException("CANNOT_MOVE_INTO_SUBTREE");
      }

      await this.availability.assertAvailable(root.ownerId, args.newParentId, root.name, root._id);
    }

    const movedIds: Types.ObjectId[] = [];
    for (const root of roots) {
      const destinationUnchanged = root.parentId?.equals(args.newParentId) ?? args.newParentId === null;
      if (destinationUnchanged) continue;

      const request = requestById.get(root._id.toString());
      if (!request) continue;

      const moved = await this.moveItem.execute({
        ownerId: root.ownerId,
        itemId: root._id,
        newParentId: args.newParentId,
        expectedMetadataVersion: request.expectedMetadataVersion,
      });
      movedIds.push(moved._id);
    }

    return movedIds;
  }
}
