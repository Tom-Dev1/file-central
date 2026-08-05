import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';
import { ExpectedMetadataVersionDto } from '../../drive-items/dto/expected-metadata-version.dto';

export class RenameDto extends ExpectedMetadataVersionDto {
  @ApiProperty({ example: 'New name.pdf' })
  @IsString()
  @MinLength(1)
  name!: string;
}
