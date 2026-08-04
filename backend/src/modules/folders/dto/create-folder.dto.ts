import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
import { IsMongoId, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateFolderDto {
  @ApiProperty({ example: 'Documents' })
  @IsString()
  @MinLength(1)
  name: string;

  @ApiPropertyOptional({ example: null, description: 'Parent folder id, null/omit for root' })
  @IsOptional()
  @IsMongoId()
  parentId?: string | null;
}
