import { IsMongoId, IsOptional } from "class-validator";
import { PaginationQueryDto } from "./pagination-query.dto";

export class DriveDriveItemsDto extends PaginationQueryDto {
    @IsOptional()
    @IsMongoId()
    parentId?: string;
}