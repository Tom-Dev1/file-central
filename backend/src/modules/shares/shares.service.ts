import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { createHash, randomBytes } from "crypto";
import { Model, Types } from "mongoose";
import { DriveItemsService } from "../drive-items/drive-items.service";
import { DriveItemType } from "../drive-items/schemas/drive-item.schema";
import { PermissionsService } from "../permissions/permissions.service";
import { UsersService } from "../users/users.service";
import { CreateShareDto } from "./dto/create-share.dto";
import { Share, ShareDocument, SharePermission, ShareType } from "./schemas/share.schema";
import { StorageObjectsService } from "../storage/storage-objects.services";

@Injectable()
export class SharesService {
  constructor(
    @InjectModel(Share.name) private readonly shareModel: Model<ShareDocument>,
    private readonly driveItems: DriveItemsService,
    private readonly permissions: PermissionsService,
    private readonly users: UsersService,
    private readonly storageObjects: StorageObjectsService
  ) {}

  async create(actorIdValue: string, dto: CreateShareDto) {
    const actorId = new Types.ObjectId(actorIdValue);
    const itemId = new Types.ObjectId(dto.itemId);
    await this.permissions.requireAccess(actorIdValue, undefined, itemId, SharePermission.EDIT);
    const item = await this.driveItems.model.findOne({ _id: itemId, isTrashed: false }).lean();
    if (!item) throw new NotFoundException("DRIVE_ITEM_NOT_FOUND");
    const share: Partial<Share> = {
      itemId,
      itemType: item.type,
      ownerId: item.ownerId,
      permission: dto.permission,
      shareType: dto.shareType,
      expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
    };
    let token: string | null = null;
    if (dto.shareType === ShareType.USER) {
      if (!dto.sharedWithEmail) throw new BadRequestException("SHARED_EMAIL_REQUIRED");
      share.sharedWithEmail = dto.sharedWithEmail.toLowerCase();
      share.sharedWithUserId = (await this.users.findByEmail(dto.sharedWithEmail))?._id ?? null;
    } else {
      token = randomBytes(32).toString("base64url");
      share.tokenHash = this.hashToken(token);
    }
    return { share: await this.shareModel.create(share), token };
  }

  listMyShares(ownerId: string) {
    return this.shareModel.find({ ownerId: new Types.ObjectId(ownerId), isRevoked: false }).lean();
  }

  async listSharedWithMe(userId: string, userEmail: string | undefined) {
    const shares = await this.shareModel
      .find({
        isRevoked: false,
        shareType: ShareType.USER,
        $or: [
          { sharedWithUserId: new Types.ObjectId(userId) },
          ...(userEmail ? [{ sharedWithEmail: userEmail.toLowerCase() }] : []),
        ],
      })
      .lean();
    const now = new Date();
    const active = shares.filter((share) => !share.expiresAt || share.expiresAt > now);
    const items = await this.driveItems.model
      .find({ _id: { $in: active.map((share) => share.itemId) }, isTrashed: false })
      .lean();
    const byId = new Map(items.map((item) => [item._id.toString(), item]));
    return active
      .map((share) => ({ share, item: byId.get(share.itemId.toString()) ?? null }))
      .filter((row) => row.item);
  }

  async listSharedFolderChildren(userId: string, userEmail: string | undefined, folderIdValue: string) {
    const folderId = new Types.ObjectId(folderIdValue);
    await this.permissions.requireAccess(userId, userEmail, folderId, SharePermission.VIEW);
    const folder = await this.driveItems.model.findOne({ _id: folderId, type: DriveItemType.FOLDER, isTrashed: false });
    if (!folder) throw new NotFoundException("SHARED_FOLDER_NOT_FOUND");
    return this.driveItems.model.find({ ownerId: folder.ownerId, parentId: folderId, isTrashed: false }).lean();
  }

  async revoke(actorId: string, shareId: string) {
    const share = await this.shareModel.findById(shareId);
    if (!share) throw new NotFoundException("SHARE_NOT_FOUND");
    await this.permissions.requireAccess(actorId, undefined, share.itemId, SharePermission.EDIT);
    share.isRevoked = true;
    await share.save();
    return { revoked: true };
  }

  async getPublicShareMetadata(token: string) {
    const share = await this.resolvePublicShare(token);
    const item = await this.driveItems.model.findOne({ _id: share.itemId, isTrashed: false });
    if (!item) throw new NotFoundException("LINK_UNAVAILABLE");
    return { item, permission: share.permission };
  }

  async getPublicDownloadUrl(token: string) {
    const share = await this.resolvePublicShare(token);
    if (![SharePermission.DOWNLOAD, SharePermission.EDIT].includes(share.permission))
      throw new NotFoundException("LINK_UNAVAILABLE");
    const item = await this.driveItems.model.findOne({ _id: share.itemId, type: DriveItemType.FILE, isTrashed: false });
    if (!item?.storageObjectId) throw new NotFoundException("LINK_UNAVAILABLE");
    return {
      url: await this.storageObjects.getPresignedDownloadUrl(item.storageObjectId, item.ownerId),
      expiresInSeconds: 3600,
    };
  }

  async cleanupItems(itemIds: Types.ObjectId[]): Promise<void> {
    if (itemIds.length) await this.shareModel.deleteMany({ itemId: { $in: itemIds } });
  }

  private async resolvePublicShare(token: string): Promise<ShareDocument> {
    const share = await this.shareModel
      .findOne({ tokenHash: this.hashToken(token), shareType: ShareType.PUBLIC_LINK, isRevoked: false })
      .select("+tokenHash");
    if (!share || (share.expiresAt && share.expiresAt < new Date())) throw new NotFoundException("LINK_UNAVAILABLE");
    return share;
  }

  private hashToken(token: string): Buffer {
    return createHash("sha256").update(token).digest();
  }
}
