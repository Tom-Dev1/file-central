import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsEmail,
  IsEnum,
  IsMongoId,
  IsOptional,
  ValidateIf,
} from 'class-validator';
import { ShareType, SharePermission } from '../schemas/share.schema';

export class CreateShareDto {
  @ApiProperty({ example: '665f1c2e2f8b9a0012345678' })
  @IsMongoId()
  itemId: string;

  @ApiProperty({ enum: ShareType, example: ShareType.USER })
  @IsEnum(ShareType)
  shareType: ShareType;

  @ApiProperty({ enum: SharePermission, example: SharePermission.VIEW })
  @IsEnum(SharePermission)
  permission: SharePermission;

  @ApiPropertyOptional({ example: 'friend@gmail.com' })
  @ValidateIf((o) => o.shareType === ShareType.USER)
  @IsEmail()
  sharedWithEmail?: string;

  @ApiPropertyOptional({ example: null, nullable: true })
  @IsOptional()
  @IsDateString()
  expiresAt?: string | null;
}
