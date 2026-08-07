import { Test, TestingModule } from "@nestjs/testing";
import { getModelToken } from "@nestjs/mongoose";
import { Types } from "mongoose";
import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { PermissionsService } from "./permissions.service";
import { DriveItemLookupQuery } from "../drive-items/application/queries/drive-item-lookup.query";
import { DriveItemType } from "../drive-items/domain/enums/drive-item.enum";
import { Share, SharePermission } from "../shares/schemas/share.schema";

/**
 * A minimal chainable query mock supporting the exact call patterns used
 * by PermissionsService: `.select().lean()` and plain `await model.findById(id)`.
 * Deliberately NOT a full Mongoose emulation - just enough surface area
 * for these tests, so we don't need mongodb-memory-server (which would
 * require downloading a mongod binary - not available in an offline/
 * network-restricted CI environment).
 */
function createQuery<T>(resolver: () => Promise<T>) {
  const query: any = {
    select: () => query,
    lean: () => resolver(),
    then: (resolve: any, reject: any) => resolver().then(resolve, reject),
    catch: (reject: any) => resolver().catch(reject),
  };
  return query;
}

interface FakeDriveItem {
  _id: Types.ObjectId;
  ownerId: Types.ObjectId;
  parentId: Types.ObjectId | null;
  type: DriveItemType;
  isTrashed: boolean;
}

interface FakeShare {
  _id: Types.ObjectId;
  itemId: Types.ObjectId;
  sharedWithUserId?: Types.ObjectId | null;
  sharedWithEmail?: string | null;
  permission: SharePermission;
  isRevoked?: boolean;
  expiresAt?: Date | null;
}

describe("PermissionsService", () => {
  let service: PermissionsService;
  let driveItems: FakeDriveItem[];
  let shares: FakeShare[];

  const userA = new Types.ObjectId(); // owner of everything below
  const userB = new Types.ObjectId(); // recipient of shares
  const userB_email = "userb@example.com";
  const userC = new Types.ObjectId(); // unrelated third party

  const grandparentFolder: FakeDriveItem = {
    _id: new Types.ObjectId(),
    ownerId: userA,
    parentId: null,
    type: DriveItemType.FOLDER,
    isTrashed: false,
  };
  const parentFolder: FakeDriveItem = {
    _id: new Types.ObjectId(),
    ownerId: userA,
    parentId: grandparentFolder._id,
    type: DriveItemType.FOLDER,
    isTrashed: false,
  };
  const file: FakeDriveItem = {
    _id: new Types.ObjectId(),
    ownerId: userA,
    parentId: parentFolder._id,
    type: DriveItemType.FILE,
    isTrashed: false,
  };

  beforeEach(async () => {
    // Reset fixtures before every test so mutations (e.g. revoke) in one
    // test never leak into another.
    driveItems = [{ ...grandparentFolder }, { ...parentFolder }, { ...file }];
    shares = [];

    const driveItemQueryMock = {
      findById: jest.fn((id: Types.ObjectId) =>
        Promise.resolve(driveItems.find((i) => i._id.equals(id))).then(
          (found) => (found ? { ...found } : null),
        ),
      ),
    };

    const shareModelMock = {
      find: jest.fn((filter: any) =>
        createQuery(async () => {
          const itemIds: Types.ObjectId[] = filter.itemId.$in;
          return shares.filter((s) => {
            const matchesItem = itemIds.some((id) => id.equals(s.itemId));
            const notRevoked = !s.isRevoked;
            const matchesUser =
              (s.sharedWithUserId && s.sharedWithUserId.equals(userB)) || s.sharedWithEmail === userB_email;
            return matchesItem && notRevoked && matchesUser;
          });
        })
      ),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PermissionsService,
        { provide: DriveItemLookupQuery, useValue: driveItemQueryMock },
        { provide: getModelToken(Share.name), useValue: shareModelMock },
      ],
    }).compile();

    service = module.get(PermissionsService);
  });

  it("1. owner always has EDIT permission, even with zero shares", async () => {
    const access = await service.getAccess(userA.toString(), undefined, file._id);
    expect(access.isOwner).toBe(true);
    expect(access.permission).toBe(SharePermission.EDIT);
  });

  it("2. unrelated user with no share has null permission", async () => {
    const access = await service.getAccess(userC.toString(), "userc@example.com", file._id);
    expect(access.isOwner).toBe(false);
    expect(access.permission).toBeNull();
  });

  it("3. direct share on the file grants exactly the configured permission", async () => {
    shares.push({
      _id: new Types.ObjectId(),
      itemId: file._id,
      sharedWithUserId: userB,
      permission: SharePermission.DOWNLOAD,
    });

    const access = await service.getAccess(userB.toString(), userB_email, file._id);
    expect(access.isOwner).toBe(false);
    expect(access.permission).toBe(SharePermission.DOWNLOAD);
  });

  it("4. sharing the parent folder cascades permission down to a child file", async () => {
    shares.push({
      _id: new Types.ObjectId(),
      itemId: parentFolder._id,
      sharedWithUserId: userB,
      permission: SharePermission.EDIT,
    });

    const access = await service.getAccess(userB.toString(), userB_email, file._id);
    expect(access.isOwner).toBe(false);
    expect(access.permission).toBe(SharePermission.EDIT);
  });

  it("5. sharing the grandparent folder still cascades down two levels to the file", async () => {
    shares.push({
      _id: new Types.ObjectId(),
      itemId: grandparentFolder._id,
      sharedWithUserId: userB,
      permission: SharePermission.VIEW,
    });

    const access = await service.getAccess(userB.toString(), userB_email, file._id);
    expect(access.permission).toBe(SharePermission.VIEW);
  });

  it("6. a revoked share no longer grants access", async () => {
    shares.push({
      _id: new Types.ObjectId(),
      itemId: file._id,
      sharedWithUserId: userB,
      permission: SharePermission.EDIT,
      isRevoked: true,
    });

    const access = await service.getAccess(userB.toString(), userB_email, file._id);
    expect(access.permission).toBeNull();
  });

  it("7. an expired share no longer grants access", async () => {
    shares.push({
      _id: new Types.ObjectId(),
      itemId: file._id,
      sharedWithUserId: userB,
      permission: SharePermission.EDIT,
      expiresAt: new Date(Date.now() - 1000 * 60 * 60), // 1 hour in the past
    });

    const access = await service.getAccess(userB.toString(), userB_email, file._id);
    expect(access.permission).toBeNull();
  });

  it("8. when multiple shares apply, the HIGHEST permission wins", async () => {
    // Direct share on the file: view only.
    shares.push({
      _id: new Types.ObjectId(),
      itemId: file._id,
      sharedWithUserId: userB,
      permission: SharePermission.VIEW,
    });
    // But the parent folder was also shared with edit.
    shares.push({
      _id: new Types.ObjectId(),
      itemId: parentFolder._id,
      sharedWithUserId: userB,
      permission: SharePermission.EDIT,
    });

    const access = await service.getAccess(userB.toString(), userB_email, file._id);
    expect(access.permission).toBe(SharePermission.EDIT);
  });

  it("9. requireAccess throws ForbiddenException when permission is insufficient", async () => {
    shares.push({
      _id: new Types.ObjectId(),
      itemId: file._id,
      sharedWithUserId: userB,
      permission: SharePermission.VIEW,
    });

    await expect(service.requireAccess(userB.toString(), userB_email, file._id, SharePermission.EDIT)).rejects.toThrow(
      ForbiddenException
    );
  });

  it("10. requireAccess (and getAccess) throws NotFoundException for a soft-deleted item", async () => {
    const deletedFile = driveItems.find((i) => i._id.equals(file._id))!;
    deletedFile.isTrashed = true;

    await expect(service.getAccess(userA.toString(), undefined, file._id)).rejects.toThrow(NotFoundException);
  });

  it("bonus: hasAccess returns false instead of throwing on insufficient permission", async () => {
    const result = await service.hasAccess(userC.toString(), "userc@example.com", file._id, SharePermission.VIEW);
    expect(result).toBe(false);
  });
});
