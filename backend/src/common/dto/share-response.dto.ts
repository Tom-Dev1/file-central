import { Expose, Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ShareResponseDto {
  @ApiProperty()
  @Expose()
  @Transform(({ obj }) => (obj._id ?? obj.id)?.toString())
  id: string;

  @ApiProperty()
  @Expose()
  @Transform(({ obj }) => obj.itemId?.toString())
  itemId: string;

  @ApiProperty({ enum: ['file', 'folder'] })
  @Expose()
  itemType: 'file' | 'folder';

  @ApiProperty()
  @Expose()
  @Transform(({ obj }) => obj.ownerId?.toString())
  ownerId: string;

  @ApiPropertyOptional({ nullable: true })
  @Expose()
  @Transform(({ obj }) => (obj.sharedWithUserId ? obj.sharedWithUserId.toString() : null))
  sharedWithUserId: string | null;

  @ApiPropertyOptional({ nullable: true })
  @Expose()
  sharedWithEmail?: string | null;

  @ApiProperty({ enum: ['view', 'download', 'edit'] })
  @Expose()
  permission: 'view' | 'download' | 'edit';

  @ApiProperty({ enum: ['user', 'public_link'] })
  @Expose()
  shareType: 'user' | 'public_link';

  @ApiPropertyOptional({ nullable: true })
  @Expose()
  expiresAt?: Date | null;

  @ApiProperty()
  @Expose()
  isRevoked: boolean;

  @ApiProperty()
  @Expose()
  createdAt: Date;
}
