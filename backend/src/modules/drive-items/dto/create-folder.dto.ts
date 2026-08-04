import { Transform } from "class-transformer";
import { IsMongoId, IsOptional } from "class-validator";

import { DriveItemNameDto } from "./drive-item-name.dto";

export class CreateFolderDto extends DriveItemNameDto {
  @Transform(({ value }) => (value === "" ? null : value))
  @IsOptional()
  @IsMongoId()
  parentId?: string | null;
}
