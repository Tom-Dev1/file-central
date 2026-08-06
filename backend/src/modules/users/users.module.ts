import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { User, UserSchema } from "./schemas/user.schema";
import { UsersService } from "./users.service";
import { QuotaModule } from "../quota/quota.module";

@Module({
  imports: [MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]), QuotaModule],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
