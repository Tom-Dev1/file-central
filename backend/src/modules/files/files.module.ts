import { Module, OnModuleInit } from "@nestjs/common";
import { mkdir } from "fs/promises";
import { tmpdir } from "os";
import { DriveItemsModule } from "../drive-items/drive-items.module";
import { StorageModule } from "../storage/storage.module";
import { PermissionsModule } from "../permissions/permissions.module";
import { FilesService } from "./files.service";
import { FilesController } from "./files.controller";

const UPLOAD_TMP_DIR = process.env.UPLOAD_TMP_DIR || `${tmpdir()}/file-central-uploads`;

import { QuotaModule } from "../quota/quota.module";
import { FileMetadataResolverService } from "./file-metadata-resolver.service";

@Module({
  imports: [DriveItemsModule, StorageModule, PermissionsModule, QuotaModule],
  controllers: [FilesController],
  providers: [FilesService, FileMetadataResolverService],
})
export class FilesModule implements OnModuleInit {
  async onModuleInit() {
    await mkdir(UPLOAD_TMP_DIR, { recursive: true });
  }
}
