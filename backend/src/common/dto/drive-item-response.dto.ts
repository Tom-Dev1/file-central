import { Expose, Transform } from "class-transformer";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { DriveItemType, FileStatus } from "../../modules/drive-items/domain/enums/drive-item.enum";

/**
 * Public-facing shape of a DriveItem. Deliberately does NOT expose
 * `objectKey` / `bucket` (internal MinIO storage details the client has
 * no business knowing - it downloads through /files/:id/download, not
 * by talking to MinIO directly) nor raw Mongoose fields like `__v`.
 */
export class DriveItemResponseDto {
  @ApiProperty()
  @Expose()
  @Transform(({ obj }) => (obj._id ?? obj.id)?.toString())
  id!: string;

  @ApiProperty()
  @Expose()
  name!: string;

  @ApiProperty({ enum: DriveItemType })
  @Expose()
  type!: DriveItemType;

  @ApiProperty({ enum: FileStatus, nullable: true })
  @Expose()
  fileStatus!: FileStatus | null;

  @ApiPropertyOptional()
  @Expose()
  mimeType!: string | null;

  @ApiPropertyOptional()
  @Expose()
  @Transform(({ obj }) => {
    const value = obj.sizeBytes ?? obj.size;
    return value === null || value === undefined ? null : value.toString();
  })
  sizeBytes!: string | null;

  @ApiPropertyOptional()
  @Expose()
  extension!: string | null;

  @ApiPropertyOptional({ nullable: true })
  @Expose()
  childCount!: number | null;

  @ApiProperty()
  @Expose()
  @Transform(({ obj }) => obj.ownerId?.toString())
  ownerId!: string;

  @ApiPropertyOptional({ nullable: true })
  @Expose()
  @Transform(({ obj }) => (obj.parentId ? obj.parentId.toString() : null))
  parentId!: string | null;

  @ApiProperty()
  @Expose()
  isTrashed!: boolean;

  @ApiPropertyOptional({ nullable: true })
  @Expose()
  @Transform(({ value }) => (value ? new Date(value).toISOString() : null))
  trashedAt!: string | null;

  @ApiProperty()
  @Expose()
  metadataVersion!: number;

  @ApiProperty()
  @Expose()
  @Transform(({ value }) => new Date(value).toISOString())
  createdAt!: string;

  @ApiProperty()
  @Expose()
  @Transform(({ value }) => new Date(value).toISOString())
  updatedAt!: string;

  @ApiProperty()
  @Expose()
  @Transform(({ value }) => new Date(value).toISOString())
  lastModifiedAt!: string;
}
