import { ApiProperty } from "@nestjs/swagger";
import { IsBoolean } from "class-validator";

export class SetStarredDto {
  @ApiProperty()
  @IsBoolean()
  starred!: boolean;
}
