import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { MongooseModule } from "@nestjs/mongoose";
import { ThrottlerModule, ThrottlerGuard } from "@nestjs/throttler";
import { AuthModule } from "./modules/auth/auth.module";
import { UsersModule } from "./modules/users/users.module";
import { DriveItemsModule } from "./modules/drive-items/drive-items.module";
import { FoldersModule } from "./modules/folders/folders.module";
import { FilesModule } from "./modules/files/files.module";
import { DriveModule } from "./modules/drive/drive.module";

import { TrashModule } from "./modules/drive/trash/trash.module";
import { PermissionsModule } from "./modules/permissions/permissions.module";
import { StorageModule } from "./modules/storage/storage.module";
import { SharesModule } from "./modules/shares/shares.module";
import { S3Module } from "./modules/s3/s3.module";
import {
  appConfig,
  databaseConfig,
  envValidationSchema,
  loggingConfig,
  s3Config,
} from "./configs";
import { UploadsModule } from "./modules/upload/uploads.module";
import { HealthModule } from "./infrastructure/health/health.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      load: [appConfig, databaseConfig, loggingConfig, s3Config],
      validationSchema: envValidationSchema,
      validationOptions: { allowUnknown: true, abortEarly: false },
    }),
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        uri: config.getOrThrow<string>("database.uri"),
        minPoolSize: config.get<number>("database.minPoolSize"),
        maxPoolSize: config.get<number>("database.maxPoolSize"),
        autoIndex: config.get<boolean>("database.autoIndex"),
      }),
    }),
    S3Module,
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
    UploadsModule,
    HealthModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
