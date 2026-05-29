import { Module } from '@nestjs/common';

import { AdminPromoCodesController } from './admin-promo-codes.controller';
import { PromoCodesService } from './promo-codes.service';

@Module({
  controllers: [AdminPromoCodesController],
  providers: [PromoCodesService],
  exports: [PromoCodesService],
})
export class PromoCodesModule {}
