import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import { Share, ShareDocument, SharePermission } from "../shares/schemas/share.schema";
import { DriveItem, DriveItemDocument } from "../drive-items/schemas/drive-item.schema";

const PERMISSION_RANK: Record<SharePermission, number> = {
  [SharePermission.VIEW]: 1,
  [SharePermission.DOWNLOAD]: 2,
  [SharePermission.EDIT]: 3,
};

import 'reflect-metadata';

export interface AccessResult {
  isOwner: boolean;
  permission: SharePermission | null; // highest permission the user effectively has, null = no access
}

@Injectable()
export class PermissionsService {
  constructor(
    @InjectModel(DriveItem.name) private driveItemModel: Model<DriveItemDocument>,
    @InjectModel(Share.name) private shareModel: Model<ShareDocument>
  ) {}

  /**
   * Walks parentId pointers from `item` up to the root, returning the
   * ordered list of ancestor ids INCLUDING the item itself (first element).
   */
  async getAncestorChain(itemId: Types.ObjectId): Promise<Types.ObjectId[]> {
    const chain: Types.ObjectId[] = [];
    let current = await this.driveItemModel.findById(itemId).select("_id parentId").lean();
    if (!current) return chain;
    chain.push(current._id);

    // Guard against pathological cycles with a max-depth cutoff.
    let depth = 0;
    while (current?.parentId && depth < 1000) {
      const parent = await this.driveItemModel.findById(current.parentId).select("_id parentId").lean();
      if (!parent) break;
      chain.push(parent._id);
      current = parent;
      depth++;
    }
    return chain;
  }

  /**
   * Determines the effective access a user has on an item:
   * - owner => always full access
   * - otherwise, look for a non-revoked, non-expired Share either directly
   *   on the item OR on any ancestor folder (folder shares cascade down),
   *   and take the highest permission found.
   */
  async getAccess(userId: string, userEmail: string | undefined, itemId: Types.ObjectId): Promise<AccessResult> {
    const item = await this.driveItemModel.findById(itemId);
    if (!item || item.isTrashed) {
      throw new NotFoundException("Item not found");
    }

    if (item.ownerId.toString() === userId) {
      return { isOwner: true, permission: SharePermission.EDIT };
    }

    const chain = Array.isArray(item.ancestorIds)
      ? [item._id, ...item.ancestorIds]
      : await this.getAncestorChain(itemId);

    const shareFilter: any = {
      itemId: { $in: chain },
      isRevoked: { $ne: true },
      $or: [
        { sharedWithUserId: new Types.ObjectId(userId) },
        ...(userEmail ? [{ sharedWithEmail: userEmail.toLowerCase() }] : []),
      ],
    };

    const shares = await this.shareModel.find(shareFilter).lean();
    const now = new Date();
    const active = shares.filter((s) => !s.expiresAt || s.expiresAt > now);

    if (active.length === 0) {
      return { isOwner: false, permission: null };
    }

    const best = active.reduce((acc, s) => (PERMISSION_RANK[s.permission] > PERMISSION_RANK[acc.permission] ? s : acc));

    return { isOwner: false, permission: best.permission };
  }

  /**
   * Throws ForbiddenException/NotFoundException unless the user has at
   * least `required` permission on the item. Returns the access result
   * (and the item) on success so callers can avoid a duplicate lookup.
   */
  async requireAccess(
    userId: string,
    userEmail: string | undefined,
    itemId: Types.ObjectId,
    required: SharePermission
  ): Promise<AccessResult> {
    const access = await this.getAccess(userId, userEmail, itemId);
    if (access.isOwner) return access;

    if (!access.permission || PERMISSION_RANK[access.permission] < PERMISSION_RANK[required]) {
      throw new ForbiddenException(`Requires "${required}" permission on this item`);
    }
    return access;
  }

  /**
   * Returns true/false without throwing - useful for filtering lists
   * (e.g. "shared with me") where a mismatch should just be skipped.
   */
  async hasAccess(
    userId: string,
    userEmail: string | undefined,
    itemId: Types.ObjectId,
    required: SharePermission
  ): Promise<boolean> {
    try {
      await this.requireAccess(userId, userEmail, itemId, required);
      return true;
    } catch {
      return false;
    }
  }
  async findShareEntryPoint(
    userId: string,
    userEmail: string | undefined,
    chainRootFirst: Types.ObjectId[]
  ): Promise<Types.ObjectId | null> {
    if (chainRootFirst.length === 0) return null;

    const shares = await this.shareModel
      .find({
        itemId: { $in: chainRootFirst },
        isRevoked: { $ne: true },
        $or: [
          { sharedWithUserId: new Types.ObjectId(userId) },
          ...(userEmail ? [{ sharedWithEmail: userEmail.toLowerCase() }] : []),
        ],
      })
      .lean();

    const now = new Date();
    const activeIds = new Set(shares.filter((s) => !s.expiresAt || s.expiresAt > now).map((s) => s.itemId.toString()));

    for (const id of chainRootFirst) {
      if (activeIds.has(id.toString())) return id;
    }
    return null;
  }
}
