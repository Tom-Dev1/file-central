import { IsNotEmpty, IsString } from "class-validator";

export class PresignPutDto {
  @IsString()
  @IsNotEmpty()
  filename!: string;

  @IsString()
  @IsNotEmpty()
  contentType!: string;
}
