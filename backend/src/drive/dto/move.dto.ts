import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsMongoId, IsOptional } from 'class-validator';

export class MoveDto {
  @ApiPropertyOptional({ example: null, description: 'New parent folder id, null for root' })
  @IsOptional()
  @IsMongoId()
  newParentId?: string | null;
}
