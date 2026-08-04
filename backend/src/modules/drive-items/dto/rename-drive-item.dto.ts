import { Type } from "class-transformer";
import { IsInt, Min } from "class-validator";

import { DriveItemNameDto } from "./drive-item-name.dto";

export class RenameDriveItemDto extends DriveItemNameDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  expectedMetadataVersion: number;
}
