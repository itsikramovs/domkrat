import { BadRequestException, Controller, Get, Query } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import type { AuthenticatedUser } from '../auth/types';

import { MerchantAnalyticsService } from './analytics.service';

@ApiTags('Merchant · Analytics')
@ApiBearerAuth()
@Roles(UserRole.MERCHANT, UserRole.MERCHANT_STAFF)
@Controller('merchant/analytics')
export class MerchantAnalyticsController {
  constructor(private readonly service: MerchantAnalyticsService) {}

  @Get('summary')
  @ApiOperation({ summary: 'Сводная аналитика мерчанта за период (по умолчанию 30 дней)' })
  getSummary(@CurrentUser() user: AuthenticatedUser, @Query('range') range?: string) {
    if (!user.merchantId) throw new BadRequestException('User is not linked to a merchant');
    const rangeDays = Math.min(Math.max(Number(range ?? 30) || 30, 1), 365);
    return this.service.getSummary(user.merchantId, rangeDays);
  }
}
