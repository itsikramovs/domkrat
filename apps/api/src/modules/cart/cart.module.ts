import { Module } from '@nestjs/common';

import { PromoCodesModule } from '../promo-codes/promo-codes.module';

import { CartController } from './cart.controller';
import { CartService } from './cart.service';
import { PricingService } from './pricing.service';

@Module({
  imports: [PromoCodesModule],
  controllers: [CartController],
  providers: [CartService, PricingService],
  exports: [CartService, PricingService],
})
export class CartModule {}
