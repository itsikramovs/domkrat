import { Module } from '@nestjs/common';

import { MerchantAnalyticsController } from './analytics.controller';
import { MerchantAnalyticsService } from './analytics.service';

@Module({
  controllers: [MerchantAnalyticsController],
  providers: [MerchantAnalyticsService],
})
export class MerchantAnalyticsModule {}
