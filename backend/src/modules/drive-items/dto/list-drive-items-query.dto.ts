import { Transform, Type } from "class-transformer";
import { IsEnum, IsInt, IsMongoId, IsOptional, IsString, Max, MaxLength, Min } from "class-validator";

import { DriveItemSortBy, DriveItemType, SortOrder } from "../enums/drive-item.enum";

export class ListDriveItemsQueryDto {
  @Transform(({ value }) => (value === "" ? null : value))
  @IsOptional()
  @IsMongoId()
  parentId?: string | null;

  @IsOptional()
  @IsEnum(DriveItemType)
  type?: DriveItemType;

  @IsOptional()
  @IsString()
  @MaxLength(512)
  cursor?: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 50;

  @IsOptional()
  @IsEnum(DriveItemSortBy)
  sortBy: DriveItemSortBy = DriveItemSortBy.NAME;

  @IsOptional()
  @IsEnum(SortOrder)
  sortOrder: SortOrder = SortOrder.ASC;
}
