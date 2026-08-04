import { Transform } from "class-transformer";
import { IsString, Matches, MaxLength, MinLength } from "class-validator";

const DRIVE_ITEM_NAME_PATTERN = /^(?!\.{1,2}$)[^/\\\u0000-\u001f\u007f]+$/u;

export class DriveItemNameDto {
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @MinLength(1, { message: "Name must not be empty." })
  @MaxLength(255, { message: "Name must not exceed 255 characters." })
  @Matches(DRIVE_ITEM_NAME_PATTERN, {
    message: 'Name must not be "." or ".." and must not contain path separators or control characters.',
  })
  name: string;
}
