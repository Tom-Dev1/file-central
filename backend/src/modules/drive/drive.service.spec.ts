import { Types } from "mongoose";

import { SharePermission } from "../shares/schemas/share.schema";
import { DriveService } from "./drive.service";

function createService(overrides?: {
  moveItemsCommand?: { execute: jest.Mock };
  trashItemsCommand?: { execute: jest.Mock };
  permissions?: { requireAccess: jest.Mock };
}) {
  const moveItemsCommand = overrides?.moveItemsCommand ?? {
    execute: jest.fn(),
  };
  const trashItemsCommand = overrides?.trashItemsCommand ?? {
    execute: jest.fn(),
  };
  const permissions = overrides?.permissions ?? {
    requireAccess: jest.fn(),
  };
  const service = new DriveService(
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    moveItemsCommand as never,
    {} as never,
    trashItemsCommand as never,
    permissions as never,
  );

  return { service, moveItemsCommand, trashItemsCommand, permissions };
}

describe("DriveService bulk move", () => {
  it("verifies edit access for every item before moving", async () => {
    const firstId = new Types.ObjectId();
    const secondId = new Types.ObjectId();
    const parentId = new Types.ObjectId();
    const moveItemsCommand = {
      execute: jest.fn().mockResolvedValue([firstId, secondId]),
    };
    const permissions = {
      requireAccess: jest.fn().mockResolvedValue({ isOwner: true }),
    };
    const { service } = createService({ moveItemsCommand, permissions });

    await expect(
      service.moveMany("user-id", "user@example.com", {
        items: [
          { id: firstId.toString(), expectedMetadataVersion: 2 },
          { id: secondId.toString(), expectedMetadataVersion: 4 },
        ],
        newParentId: parentId.toString(),
      }),
    ).resolves.toEqual({ movedIds: [firstId.toString(), secondId.toString()] });

    expect(permissions.requireAccess).toHaveBeenCalledTimes(2);
    expect(permissions.requireAccess).toHaveBeenNthCalledWith(
      1,
      "user-id",
      "user@example.com",
      firstId,
      SharePermission.EDIT,
    );
    expect(moveItemsCommand.execute).toHaveBeenCalledWith({
      items: [
        { itemId: firstId, expectedMetadataVersion: 2 },
        { itemId: secondId, expectedMetadataVersion: 4 },
      ],
      newParentId: parentId,
    });
  });

  it("does not move when any permission check fails", async () => {
    const itemId = new Types.ObjectId();
    const accessError = new Error("forbidden");
    const moveItemsCommand = { execute: jest.fn() };
    const permissions = { requireAccess: jest.fn().mockRejectedValue(accessError) };
    const { service } = createService({ moveItemsCommand, permissions });

    await expect(
      service.moveMany("user-id", "user@example.com", {
        items: [{ id: itemId.toString(), expectedMetadataVersion: 1 }],
      }),
    ).rejects.toBe(accessError);
    expect(moveItemsCommand.execute).not.toHaveBeenCalled();
  });
});

describe("DriveService bulk trash", () => {
  it("deduplicates ids and verifies edit access before trashing", async () => {
    const firstId = new Types.ObjectId();
    const secondId = new Types.ObjectId();
    const trashItemsCommand = {
      execute: jest.fn().mockResolvedValue([firstId, secondId]),
    };
    const permissions = {
      requireAccess: jest.fn().mockResolvedValue({ isOwner: true }),
    };
    const { service } = createService({ trashItemsCommand, permissions });

    await expect(
      service.removeMany("user-id", "user@example.com", [
        firstId.toString(),
        firstId.toString(),
        secondId.toString(),
      ]),
    ).resolves.toEqual({ deletedIds: [firstId.toString(), secondId.toString()] });

    expect(permissions.requireAccess).toHaveBeenCalledTimes(2);
    expect(permissions.requireAccess).toHaveBeenNthCalledWith(
      1,
      "user-id",
      "user@example.com",
      firstId,
      SharePermission.EDIT,
    );
    expect(trashItemsCommand.execute).toHaveBeenCalledWith([firstId, secondId]);
  });

  it("does not mutate when any permission check fails", async () => {
    const itemId = new Types.ObjectId();
    const accessError = new Error("forbidden");
    const trashItemsCommand = { execute: jest.fn() };
    const permissions = { requireAccess: jest.fn().mockRejectedValue(accessError) };
    const { service } = createService({ trashItemsCommand, permissions });

    await expect(
      service.removeMany("user-id", "user@example.com", [itemId.toString()]),
    ).rejects.toBe(accessError);
    expect(trashItemsCommand.execute).not.toHaveBeenCalled();
  });
});
