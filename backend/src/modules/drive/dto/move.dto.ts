import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsMongoId, IsOptional } from 'class-validator';
import { ExpectedMetadataVersionDto } from '../../drive-items/dto/requests/expected-metadata-version.dto';

export class MoveDto extends ExpectedMetadataVersionDto {
  @ApiPropertyOptional({ example: null, description: 'New parent folder id, null for root' })
  @IsOptional()
  @IsMongoId()
  newParentId?: string | null;
}
