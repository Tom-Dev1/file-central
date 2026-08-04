import { Transform } from "class-transformer";
import { IsMongoId, IsOptional } from "class-validator";

export class UploadFileDto {
  @Transform(({ value }) => (value === "" ? null : value))
  @IsOptional()
  @IsMongoId()
  parentId?: string | null;
}
