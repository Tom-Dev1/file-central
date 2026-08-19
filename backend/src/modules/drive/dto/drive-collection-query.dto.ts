import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsEnum, IsOptional } from "class-validator";
import {
  DriveItemSortBy,
  DriveItemSortDirection,
} from "../../drive-items/domain/enums/drive-item.enum";
import { PaginationQueryDto } from "./pagination-query.dto";

export class DriveCollectionQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: DriveItemSortBy })
  @IsOptional()
  @IsEnum(DriveItemSortBy)
  sort?: DriveItemSortBy;

  @ApiPropertyOptional({ enum: DriveItemSortDirection })
  @IsOptional()
  @IsEnum(DriveItemSortDirection)
  direction?: DriveItemSortDirection;
}
