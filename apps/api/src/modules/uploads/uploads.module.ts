import { Module } from '@nestjs/common';

import { CatalogModule } from '../catalog/catalog.module';
import { UploadsController } from './controllers/uploads.controller';
import { StorageService } from './services/storage.service';

@Module({
  imports: [CatalogModule],
  controllers: [UploadsController],
  providers: [StorageService],
  exports: [StorageService],
})
export class UploadsModule {}
