import { Module } from '@nestjs/common';

import { MerchantFinanceController } from './finance.controller';
import { FinanceService } from './finance.service';

@Module({
  controllers: [MerchantFinanceController],
  providers: [FinanceService],
  exports: [FinanceService],
})
export class FinanceModule {}
