import { Types } from "mongoose";
import { TrashDriveItemCommand } from "./trash-drive-item.command";

describe("TrashDriveItemCommand", () => {
  it("does not mutate descendants when another request wins the root claim", async () => {
    const rootId = new Types.ObjectId();
    const model = {
      findOne: jest.fn().mockResolvedValue({
        _id: rootId,
        ownerId: new Types.ObjectId(),
        parentId: null,
      }),
      find: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            lean: jest.fn().mockResolvedValue([{ _id: new Types.ObjectId() }]),
          }),
        }),
      }),
      findOneAndUpdate: jest.fn().mockResolvedValue(null),
      updateMany: jest.fn(),
    };
    const childCounts = { adjust: jest.fn() };
    const command = new TrashDriveItemCommand({ model } as never, childCounts as never);

    await expect(command.execute(rootId)).resolves.toEqual([]);
    expect(model.updateMany).not.toHaveBeenCalled();
    expect(childCounts.adjust).not.toHaveBeenCalled();
  });
});
