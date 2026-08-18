import { ConflictException } from "@nestjs/common";
import { DriveItemNamePolicy } from "./drive-item-name.policy";

describe("DriveItemNamePolicy", () => {
  const policy = new DriveItemNamePolicy();

  it("keeps generated copy names within the schema limit", () => {
    const name = policy.createCopyName(`a.${"x".repeat(253)}`, 9_999);
    expect(name.length).toBeLessThanOrEqual(255);
    expect(name).toContain("(9999)");
  });

  it("generates numbered folder names within the schema limit", () => {
    expect(policy.createFolderCopyName("Reports", 1)).toBe("Reports (1)");
    expect(policy.createFolderCopyName("a".repeat(255), 9_999)).toHaveLength(255);
  });

  it("maps Mongo unique-index errors to a domain conflict", () => {
    expect(() => policy.rethrowDuplicate({ code: 11000 })).toThrow(
      ConflictException,
    );
  });
});
