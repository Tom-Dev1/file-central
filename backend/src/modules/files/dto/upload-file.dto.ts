import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsMongoId, IsOptional } from 'class-validator';

export class UploadFileDto {
  @ApiPropertyOptional({ example: null, description: 'Destination folder id, omit for root' })
  @IsOptional()
  @IsMongoId()
  parentId?: string | null;
}
