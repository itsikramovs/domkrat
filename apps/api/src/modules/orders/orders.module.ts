import { Module } from '@nestjs/common';

import { CartModule } from '../cart/cart.module';
import { PromoCodesModule } from '../promo-codes/promo-codes.module';

import { AdminFulfillmentController } from './admin-fulfillment.controller';
import { MerchantOrdersController } from './merchant-orders.controller';
import { MerchantOrdersService } from './merchant-orders.service';
import { OrderNumberingService } from './order-numbering.service';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { PaymentsService } from './payments.service';
import { PickingService } from './picking.service';

@Module({
  imports: [CartModule, PromoCodesModule],
  controllers: [OrdersController, MerchantOrdersController, AdminFulfillmentController],
  providers: [
    OrdersService,
    OrderNumberingService,
    PaymentsService,
    MerchantOrdersService,
    PickingService,
  ],
  exports: [OrdersService, PaymentsService],
})
export class OrdersModule {}
