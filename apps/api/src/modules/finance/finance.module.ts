import { Module } from '@nestjs/common';

import { MerchantFinanceController } from './finance.controller';
import { FinanceService } from './finance.service';
import { HoldReleaseService } from './hold-release.service';

@Module({
  controllers: [MerchantFinanceController],
  providers: [FinanceService, HoldReleaseService],
  exports: [FinanceService, HoldReleaseService],
})
export class FinanceModule {}
