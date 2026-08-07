import { Controller, Delete, Get, Param, Patch, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../../../common/guards/jwt-auth.guard";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import type { AuthUser } from "../../../common/decorators/current-user.decorator";
import { TrashService } from "./trash.service";
import { toDriveItemDtoList } from "../../../common/mappers/response-mapper";

@ApiTags("trash")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("trash")
export class TrashController {
  constructor(private trashService: TrashService) {}

  @Get()
  async list(@CurrentUser() user: AuthUser) {
    const items = await this.trashService.list(user.userId);
    return toDriveItemDtoList(items);
  }

  @Patch(":id/restore")
  restore(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.trashService.restore(user.userId, id);
  }

  @Delete()
  purgeAll(@CurrentUser() user: AuthUser) {
    return this.trashService.purgeAll(user.userId);
  }

  @Delete(":id")
  purgeOne(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.trashService.purgeOne(user.userId, id);
  }
}
