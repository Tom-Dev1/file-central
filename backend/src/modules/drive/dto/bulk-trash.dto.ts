import { ApiProperty } from "@nestjs/swagger";
import { ArrayMaxSize, ArrayMinSize, IsArray, IsMongoId } from "class-validator";

export class BulkTrashDto {
  @ApiProperty({
    type: [String],
    description: "Drive item ids to move to trash",
    maxItems: 100,
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @IsMongoId({ each: true })
  itemIds!: string[];
}
