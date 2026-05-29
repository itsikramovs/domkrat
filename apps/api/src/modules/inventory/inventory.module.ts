import { Module } from '@nestjs/common';

import { AdminInventoryController } from './controllers/admin-inventory.controller';
import { MerchantInventoryController } from './controllers/merchant-inventory.controller';
import { ReceiptNumberingService } from './receipt-numbering.service';
import { InventoryService } from './services/inventory.service';
import { ReceiptsService } from './services/receipts.service';
import { WarehousesService } from './services/warehouses.service';

@Module({
  controllers: [MerchantInventoryController, AdminInventoryController],
  providers: [WarehousesService, ReceiptsService, InventoryService, ReceiptNumberingService],
  exports: [InventoryService, WarehousesService],
})
export class InventoryModule {}
