import { Module } from '@nestjs/common';

import { CartModule } from '../cart/cart.module';

import { OrderNumberingService } from './order-numbering.service';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { PaymentsService } from './payments.service';

@Module({
  imports: [CartModule],
  controllers: [OrdersController],
  providers: [OrdersService, OrderNumberingService, PaymentsService],
  exports: [OrdersService, PaymentsService],
})
export class OrdersModule {}
