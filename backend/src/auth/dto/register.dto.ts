import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsString, MinLength } from "class-validator";

export class RegisterDto {
  @ApiProperty({ example: "user@example.com" })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: "Nguyen Van A" })
  @IsString()
  @MinLength(1)
  name!: string;

  @ApiProperty({ example: "nguyenvana" })
  @IsString()
  @MinLength(1)
  username!: string;

  @ApiProperty({ example: "strongpassword123" })
  @IsString()
  @MinLength(6)
  password!: string;
}
