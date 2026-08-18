import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ActivateFileCommand } from './application/commands/files/activate-file.command';
import { CreateFilePlaceholderCommand } from './application/commands/files/create-file-placeholder.command';
import { DiscardFilePlaceholderCommand } from './application/commands/files/discard-file-placeholder.command';
import { MarkFileFailedCommand } from './application/commands/files/mark-file-failed.command';
import { MarkFileProcessingCommand } from './application/commands/files/mark-file-processing.command';
import { RollbackFileActivationCommand } from './application/commands/files/rollback-file-activation.command';
import { CreateFolderCommand } from './application/commands/folders/create-folder.command';
import { MoveDriveItemCommand } from './application/commands/items/move-drive-item.command';
import { MoveDriveItemsCommand } from './application/commands/items/move-drive-items.command';
import { RenameDriveItemCommand } from './application/commands/items/rename-drive-item.command';
import { FinalizeHardDeleteCommand } from './application/commands/trash/finalize-hard-delete.command';
import { RestoreDriveItemCommand } from './application/commands/trash/restore-drive-item.command';
import { TrashDriveItemCommand } from './application/commands/trash/trash-drive-item.command';
import { TrashDriveItemsCommand } from './application/commands/trash/trash-drive-items.command';
import { GetDriveItemAncestorsQuery } from './application/queries/get-drive-item-ancestors.query';
import { DriveItemLookupQuery } from './application/queries/drive-item-lookup.query';
import { ListTrashRootsQuery } from './application/queries/list-trash-roots.query';
import { ListDriveItemsQuery } from './application/queries/list-drive-items.query';
import { PrepareHardDeleteQuery } from './application/queries/prepare-hard-delete.query';
import { SearchDriveItemsQuery } from './application/queries/search-drive-items.query';
import { DriveItemChildCountService } from './application/services/drive-item-child-count.service';
import { DriveItemNameAvailabilityService } from './application/services/drive-item-name-availability.service';
import { DriveItemParentService } from './application/services/drive-item-parent.service';
import { RestoreNameAvailabilityService } from './application/services/restore-name-availability.service';
import { DriveItemNamePolicy } from './domain/policies/drive-item-name.policy';
import { ChildCountReconcileJob } from './infrastructure/jobs/child-count-reconcile.job';
import { DriveItemRepository } from './infrastructure/repositories/drive-item.repository';
import { DriveItem, DriveItemSchema } from './infrastructure/schemas/drive-item.schema';

const internalProviders = [
  DriveItemRepository,
  DriveItemNamePolicy,
  DriveItemNameAvailabilityService,
  RestoreNameAvailabilityService,
  DriveItemChildCountService,
  ChildCountReconcileJob,
];

const publicApplicationApi = [
  DriveItemParentService,
  CreateFolderCommand,
  RenameDriveItemCommand,
  MoveDriveItemCommand,
  MoveDriveItemsCommand,
  CreateFilePlaceholderCommand,
  ActivateFileCommand,
  RollbackFileActivationCommand,
  MarkFileFailedCommand,
  MarkFileProcessingCommand,
  DiscardFilePlaceholderCommand,
  TrashDriveItemCommand,
  TrashDriveItemsCommand,
  RestoreDriveItemCommand,
  FinalizeHardDeleteCommand,
  DriveItemLookupQuery,
  GetDriveItemAncestorsQuery,
  ListDriveItemsQuery,
  SearchDriveItemsQuery,
  ListTrashRootsQuery,
  PrepareHardDeleteQuery,
];

@Module({
  imports: [MongooseModule.forFeature([{ name: DriveItem.name, schema: DriveItemSchema }])],
  providers: [...internalProviders, ...publicApplicationApi],
  exports: publicApplicationApi,
})
export class DriveItemsModule {}
