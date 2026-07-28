import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import { Readable } from "stream";
import { Share, ShareDocument, ShareType, SharePermission } from "./schemas/share.schema";
import { CreateShareDto } from "./dto/create-share.dto";
import { DriveItemsService } from "../drive-items/drive-items.service";
import { DriveItemType } from "../drive-items/schemas/drive-item.schema";
import { PermissionsService } from "../permissions/permissions.service";
import { UsersService } from "../users/users.service";
import { MinioService } from "../storage/minio.service";
import { generateToken } from "../common/utils/token.util";

@Injectable()
export class SharesService {
  constructor(
    @InjectModel(Share.name) private shareModel: Model<ShareDocument>,
    private driveItemsService: DriveItemsService,
    private permissionsService: PermissionsService,
    private usersService: UsersService,
    private minioService: MinioService
  ) {}

  async create(ownerId: string, dto: CreateShareDto) {
    const item = await this.driveItemsService.model.findOne({
      _id: dto.itemId,
      isDeleted: false,
    });
    if (!item) throw new NotFoundException("Item not found");
    if (item.ownerId.toString() !== ownerId) {
      throw new ForbiddenException("Only the owner can share this item");
    }

    const shareDoc: Partial<Share> = {
      itemId: item._id,
      itemType: item.type,
      ownerId: item.ownerId,
      permission: dto.permission,
      shareType: dto.shareType,
      expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
    };

    if (dto.shareType === ShareType.USER) {
      if (!dto.sharedWithEmail) {
        throw new BadRequestException("sharedWithEmail is required for user shares");
      }
      shareDoc.sharedWithEmail = dto.sharedWithEmail.toLowerCase();
      const existingUser = await this.usersService.findByEmail(dto.sharedWithEmail);
      if (existingUser) {
        shareDoc.sharedWithUserId = existingUser._id;
      }
    } else {
      shareDoc.token = generateToken();
    }

    const share = await this.shareModel.create(shareDoc);
    return share;
  }

  /** Shares the current user has created (as owner). */
  async listMyShares(ownerId: string) {
    return this.shareModel.find({ ownerId: new Types.ObjectId(ownerId), isRevoked: { $ne: true } }).lean();
  }

  /**
   * Items shared directly with the current user (by userId or email),
   * i.e. the "roots" a user would see under "Shared with me". Does NOT
   * include implicit access to descendants of a shared folder - use
   * listSharedFolderChildren for that.
   */
  async listSharedWithMe(userId: string, userEmail: string | undefined) {
    const now = new Date();
    const shares = await this.shareModel
      .find({
        isRevoked: { $ne: true },
        shareType: ShareType.USER,
        $or: [
          { sharedWithUserId: new Types.ObjectId(userId) },
          ...(userEmail ? [{ sharedWithEmail: userEmail.toLowerCase() }] : []),
        ],
      })
      .lean();

    const active = shares.filter((s) => !s.expiresAt || s.expiresAt > now);
    const itemIds = active.map((s) => s.itemId);
    const items = await this.driveItemsService.model.find({ _id: { $in: itemIds }, isDeleted: false }).lean();

    const itemsById = new Map(items.map((i) => [i._id.toString(), i]));
    return active
      .map((s) => ({
        share: s,
        item: itemsById.get(s.itemId.toString()) || null,
      }))
      .filter((row) => row.item !== null);
  }

  async listSharedFolderChildren(userId: string, userEmail: string | undefined, folderId: string) {
    const objectId = new Types.ObjectId(folderId);
    await this.permissionsService.requireAccess(userId, userEmail, objectId, SharePermission.VIEW);

    const folder = await this.driveItemsService.model.findOne({
      _id: objectId,
      isDeleted: false,
    });
    if (!folder || folder.type !== DriveItemType.FOLDER) {
      throw new NotFoundException("Shared folder not found");
    }

    return this.driveItemsService.model.find({ parentId: objectId, isDeleted: false }).lean();
  }

  async revoke(ownerId: string, shareId: string) {
    const share = await this.shareModel.findOne({ _id: shareId, ownerId });
    if (!share) throw new NotFoundException("Share not found");
    share.isRevoked = true;
    await share.save();
    return { revoked: true };
  }

  // --- Public link (no auth) ---

  private async resolvePublicShare(token: string): Promise<ShareDocument> {
    const share = await this.shareModel.findOne({
      token,
      shareType: ShareType.PUBLIC_LINK,
      isRevoked: { $ne: true },
    });
    if (!share) throw new NotFoundException("Share link not found");
    if (share.expiresAt && share.expiresAt < new Date()) {
      throw new ForbiddenException("Share link has expired");
    }
    return share;
  }

  async getPublicShareMetadata(token: string) {
    const share = await this.resolvePublicShare(token);
    const item = await this.driveItemsService.model.findOne({
      _id: share.itemId,
      isDeleted: false,
    });
    if (!item) throw new NotFoundException("Shared item not found");
    return { item, permission: share.permission };
  }

  async getPublicDownloadStream(
    token: string
  ): Promise<{ stream: Readable; name: string; mimeType?: string; size?: number }> {
    const share = await this.resolvePublicShare(token);
    if (share.permission !== SharePermission.DOWNLOAD && share.permission !== SharePermission.EDIT) {
      throw new ForbiddenException("This link does not allow downloads");
    }

    const item = await this.driveItemsService.model.findOne({
      _id: share.itemId,
      isDeleted: false,
    });
    if (!item || item.type !== DriveItemType.FILE || !item.objectKey) {
      throw new NotFoundException("Shared file not found");
    }

    const stream = await this.minioService.getObjectStream(item.objectKey);
    return { stream, name: item.name, mimeType: item.mimeType, size: item.size };
  }
}
