import { Module } from '@nestjs/common';

import { AdminInventoryController } from './controllers/admin-inventory.controller';
import { AdminInventoryOpsController } from './controllers/admin-inventory-ops.controller';
import { MerchantInventoryController } from './controllers/merchant-inventory.controller';
import { ReceiptNumberingService } from './receipt-numbering.service';
import { AlertsService } from './services/alerts.service';
import { InventoryService } from './services/inventory.service';
import { ReceiptsService } from './services/receipts.service';
import { WarehousesService } from './services/warehouses.service';

@Module({
  controllers: [MerchantInventoryController, AdminInventoryController, AdminInventoryOpsController],
  providers: [
    WarehousesService,
    ReceiptsService,
    InventoryService,
    AlertsService,
    ReceiptNumberingService,
  ],
  exports: [InventoryService, WarehousesService, AlertsService],
})
export class InventoryModule {}
