import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsInt,
  IsMongoId,
  IsOptional,
  Min,
  ValidateNested,
} from "class-validator";

export class BulkMoveItemDto {
  @ApiProperty()
  @IsMongoId()
  id!: string;

  @ApiProperty({ minimum: 1 })
  @IsInt()
  @Min(1)
  expectedMetadataVersion!: number;
}

export class BulkMoveDto {
  @ApiProperty({ type: [BulkMoveItemDto], maxItems: 100 })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => BulkMoveItemDto)
  items!: BulkMoveItemDto[];

  @ApiPropertyOptional({ example: null, description: "Destination folder id, null for My Drive" })
  @IsOptional()
  @IsMongoId()
  newParentId?: string | null;
}
