import { Types } from "mongoose";
import { QuotaService } from "./quota.service";

describe("QuotaService", () => {
  it("makes a rolled-back reservation key reusable", async () => {
    const transactions = { deleteMany: jest.fn().mockResolvedValue({}) };
    const service = new QuotaService({} as never, transactions as never);
    jest.spyOn(service, "release").mockResolvedValue();
    const userId = new Types.ObjectId();

    await service.rollbackReservation(
      userId,
      100n,
      "upload:reserve",
      "upload:init-rollback",
    );

    expect(service.release).toHaveBeenCalledWith(
      userId,
      100n,
      "upload:init-rollback",
    );
    expect(transactions.deleteMany).toHaveBeenCalledWith({
      userId,
      idempotencyKey: {
        $in: ["upload:reserve", "upload:init-rollback"],
      },
    });
  });
});
