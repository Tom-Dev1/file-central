import { Expose, Transform } from "class-transformer";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

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

  @ApiProperty({ enum: ["file", "folder"] })
  @Expose()
  type!: "file" | "folder";

  @ApiPropertyOptional()
  @Expose()
  mimeType?: string;

  @ApiPropertyOptional()
  @Expose()
  size?: number;

  @ApiPropertyOptional()
  @Expose()
  extension?: string;

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
  isDeleted!: boolean;

  @ApiPropertyOptional({ nullable: true })
  @Expose()
  deletedAt?: Date | null;

  @ApiProperty()
  @Expose()
  createdAt!: Date;

  @ApiProperty()
  @Expose()
  updatedAt!: Date;

  @ApiPropertyOptional({ nullable: true })
  @Expose()
  lastModifiedAt?: Date | null;

  @ApiPropertyOptional({ nullable: true })
  @Expose()
  lastViewedAt?: Date | null;
}
