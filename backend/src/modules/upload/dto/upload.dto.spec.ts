import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";

import { CompleteUploadDto, InitUploadDto } from "./upload.dto";

describe("upload DTOs", () => {
  it("normalizes a root parent and accepts Int64 bytes as a decimal string", async () => {
    const dto = plainToInstance(InitUploadDto, {
      parentId: "",
      name: " report.pdf ",
      declaredSizeBytes: "9007199254740993",
      idempotencyKey: "upload-1",
    });

    expect(await validate(dto)).toHaveLength(0);
    expect(dto.parentId).toBeNull();
    expect(dto.name).toBe("report.pdf");
  });

  it("rejects duplicate part numbers", async () => {
    const dto = plainToInstance(CompleteUploadDto, {
      parts: [
        { partNumber: 1, etag: "a", sizeBytes: "8388608" },
        { partNumber: 1, etag: "b", sizeBytes: "1" },
      ],
    });

    expect(await validate(dto)).not.toHaveLength(0);
  });
});
