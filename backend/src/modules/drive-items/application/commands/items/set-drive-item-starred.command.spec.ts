import { NotFoundException } from "@nestjs/common";
import { Types } from "mongoose";
import { SetDriveItemStarredCommand } from "./set-drive-item-starred.command";

describe("SetDriveItemStarredCommand", () => {
  it("updates the owner item without changing Drive metadata", async () => {
    const ownerId = new Types.ObjectId();
    const itemId = new Types.ObjectId();
    const updated = { _id: itemId, ownerId, isStarred: true };
    const lean = jest.fn().mockResolvedValue(updated);
    const findOneAndUpdate = jest.fn().mockReturnValue({ lean });
    const command = new SetDriveItemStarredCommand({ model: { findOneAndUpdate } } as never);

    await expect(command.execute({ ownerId, itemId, isStarred: true })).resolves.toBe(updated);
    expect(findOneAndUpdate).toHaveBeenCalledWith(
      { _id: itemId, ownerId, isTrashed: false },
      { $set: { isStarred: true } },
      { returnDocument: "after" },
    );
  });

  it("rejects items that are missing, trashed, or owned by another user", async () => {
    const lean = jest.fn().mockResolvedValue(null);
    const findOneAndUpdate = jest.fn().mockReturnValue({ lean });
    const command = new SetDriveItemStarredCommand({ model: { findOneAndUpdate } } as never);

    await expect(
      command.execute({
        ownerId: new Types.ObjectId(),
        itemId: new Types.ObjectId(),
        isStarred: false,
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
