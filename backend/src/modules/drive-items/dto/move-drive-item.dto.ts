import { Transform, Type } from "class-transformer";
import { IsInt, IsMongoId, IsOptional, Min } from "class-validator";

export class MoveDriveItemDto {
  @Transform(({ value }) => (value === "" ? null : value))
  @IsOptional()
  @IsMongoId()
  destinationParentId?: string | null;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  expectedMetadataVersion: number;
}
