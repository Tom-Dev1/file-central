import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from './pagination-query.dto';

export class SearchQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Search text matched against item name (case-insensitive)' })
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional({ enum: ['file', 'folder'] })
  @IsOptional()
  @IsIn(['file', 'folder'])
  type?: 'file' | 'folder';
}
