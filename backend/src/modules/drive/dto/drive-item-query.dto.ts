import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsEnum, IsMongoId, IsOptional } from "class-validator";
import {
  DriveItemSortBy,
  DriveItemSortDirection,
} from "../../drive-items/domain/enums/drive-item.enum";
import { PaginationQueryDto } from "./pagination-query.dto";

export class DriveDriveItemsDto extends PaginationQueryDto {
  @IsOptional()
  @IsMongoId()
  parentId?: string;

  @ApiPropertyOptional({
    enum: DriveItemSortBy,
    default: DriveItemSortBy.NAME,
    description: "The single active column used to sort this folder",
  })
  @IsOptional()
  @IsEnum(DriveItemSortBy)
  sort?: DriveItemSortBy = DriveItemSortBy.NAME;

  @ApiPropertyOptional({
    enum: DriveItemSortDirection,
    default: DriveItemSortDirection.ASC,
  })
  @IsOptional()
  @IsEnum(DriveItemSortDirection)
  direction?: DriveItemSortDirection = DriveItemSortDirection.ASC;
}
