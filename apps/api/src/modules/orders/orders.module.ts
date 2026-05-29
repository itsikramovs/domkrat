import { Module } from '@nestjs/common';

import { CartModule } from '../cart/cart.module';
import { PromoCodesModule } from '../promo-codes/promo-codes.module';

import { MerchantOrdersController } from './merchant-orders.controller';
import { MerchantOrdersService } from './merchant-orders.service';
import { OrderNumberingService } from './order-numbering.service';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { PaymentsService } from './payments.service';

@Module({
  imports: [CartModule, PromoCodesModule],
  controllers: [OrdersController, MerchantOrdersController],
  providers: [OrdersService, OrderNumberingService, PaymentsService, MerchantOrdersService],
  exports: [OrdersService, PaymentsService],
})
export class OrdersModule {}
