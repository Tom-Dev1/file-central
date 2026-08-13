import { Body, Controller, Delete, Get, Param, Patch, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import type { AuthUser } from "../../common/decorators/current-user.decorator";
import { DriveService } from "./drive.service";
import { RenameDto } from "./dto/rename.dto";
import { MoveDto } from "./dto/move.dto";
import { PaginationQueryDto } from "./dto/pagination-query.dto";
import { SearchQueryDto } from "./dto/search-query.dto";
import { toDriveItemDto, toDriveItemDtoList } from "../../common/mappers/response-mapper";
import { DriveDriveItemsDto } from "./dto/drive-item-query.dto";
import {
  DriveItemSortBy,
  DriveItemSortDirection,
} from "../drive-items/domain/enums/drive-item.enum";

@ApiTags("drive")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("drive")
export class DriveController {
  constructor(private driveService: DriveService) { }

  // NOTE: /drive/search must be declared before /drive/:id-style routes
  // in the same controller to avoid Express matching "search" as an :id.
  @Get("search")
  async search(@CurrentUser() user: AuthUser, @Query() query: SearchQueryDto) {
    const result = await this.driveService.search(
      user.userId,
      query.q || "",
      query.type,
      query.cursor,
      query.limit ?? 50
    );
    return { ...result, items: toDriveItemDtoList(result.items) };
  }

  @Get()
  async list(
    @CurrentUser() user: AuthUser,
    @Query() query: DriveDriveItemsDto
  ) {
    const result = await this.driveService.list(
      user.userId,
      query.parentId ?? null,
      query.cursor,
      query.limit ?? 50,
      query.sort ?? DriveItemSortBy.NAME,
      query.direction ?? DriveItemSortDirection.ASC,
    );
    return { ...result, items: toDriveItemDtoList(result.items) };
  }
  @Get(":id/ancestors")
  async getAncestors(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    const chain = await this.driveService.getAncestors(user.userId, user.email, id);
    return toDriveItemDtoList(chain);
  }

  @Get(":id")
  async getById(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    const item = await this.driveService.getById(user.userId, user.email, id);
    return toDriveItemDto(item);
  }

  @Patch(":id/rename")
  async rename(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() dto: RenameDto) {
    const item = await this.driveService.rename(user.userId, user.email, id, dto);
    return toDriveItemDto(item);
  }

  @Patch(":id/move")
  async move(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() dto: MoveDto) {
    const item = await this.driveService.move(user.userId, user.email, id, dto);
    return toDriveItemDto(item);
  }

  @Delete(":id")
  remove(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.driveService.remove(user.userId, user.email, id);
  }
}
