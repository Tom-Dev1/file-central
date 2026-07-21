import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { MongooseModule } from "@nestjs/mongoose";
import { ThrottlerModule, ThrottlerGuard } from "@nestjs/throttler";
import { AuthModule } from "./auth/auth.module";
import { UsersModule } from "./users/users.module";
import { StorageModule } from "./storage/storage.module";
import { DriveItemsModule } from "./drive-items/drive-items.module";
import { PermissionsModule } from "./permissions/permissions.module";
import { FoldersModule } from "./folders/folders.module";
import { FilesModule } from "./files/files.module";
import { DriveModule } from "./drive/drive.module";
import { SharesModule } from "./shares/shares.module";
import { TrashModule } from "./drive/trash/trash.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        uri: config.get<string>("MONGO_URI") || "mongodb://localhost:27019/file-central",
      }),
    }),
    // App-wide default rate limit (generous). Auth endpoints layer a much
    // stricter @Throttle() on top of this - see AuthController.
    ThrottlerModule.forRoot([{ name: "default", ttl: 60_000, limit: 60 }]),
    AuthModule,
    UsersModule,
    StorageModule,
    DriveItemsModule,
    PermissionsModule,
    FoldersModule,
    FilesModule,
    DriveModule,
    TrashModule,
    SharesModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
