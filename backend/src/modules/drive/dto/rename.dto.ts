import { ApiProperty } from "@nestjs/swagger";
import { IsString, MinLength } from "class-validator";

export class RenameDto {
  @ApiProperty({ example: "New name.pdf" })
  @IsString()
  @MinLength(1)
  name!: string;
}
