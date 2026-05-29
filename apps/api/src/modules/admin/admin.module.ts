import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { FinanceModule } from '../finance/finance.module';

import { AdminController } from './admin.controller';
import { AdminFinanceService } from './services/admin-finance.service';
import { AdminMerchantsService } from './services/admin-merchants.service';
import { AdminOrdersService } from './services/admin-orders.service';
import { AdminUsersService } from './services/admin-users.service';

@Module({
  imports: [FinanceModule, AuthModule],
  controllers: [AdminController],
  providers: [AdminUsersService, AdminMerchantsService, AdminOrdersService, AdminFinanceService],
  exports: [AdminFinanceService],
})
export class AdminModule {}
