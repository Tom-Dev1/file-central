import { ApiProperty } from "@nestjs/swagger";
import { IsString, MinLength } from "class-validator";

export class RefreshTokenDto {
  @ApiProperty({ example: "9f3a...(raw refresh token from login response)" })
  @IsString()
  @MinLength(10)
  refreshToken!: string;
}
