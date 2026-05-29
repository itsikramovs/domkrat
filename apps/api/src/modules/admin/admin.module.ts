import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { FinanceModule } from '../finance/finance.module';

import { AdminController } from './admin.controller';
import { AdminAnalyticsService } from './services/admin-analytics.service';
import { AdminCustomersService } from './services/admin-customers.service';
import { AdminFinanceService } from './services/admin-finance.service';
import { AdminMerchantsService } from './services/admin-merchants.service';
import { AdminOrdersService } from './services/admin-orders.service';
import { AdminUsersService } from './services/admin-users.service';

@Module({
  imports: [FinanceModule, AuthModule],
  controllers: [AdminController],
  providers: [
    AdminUsersService,
    AdminCustomersService,
    AdminMerchantsService,
    AdminOrdersService,
    AdminFinanceService,
    AdminAnalyticsService,
  ],
  exports: [AdminFinanceService],
})
export class AdminModule {}
