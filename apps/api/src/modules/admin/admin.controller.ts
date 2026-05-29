import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  DocumentStatus,
  MerchantStatus,
  OrderStatus,
  UserRole,
  VerificationStatus,
  WithdrawalStatus,
} from '@prisma/client';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import type { AuthenticatedUser } from '../auth/types';

import { HoldReleaseService } from '../finance/hold-release.service';

import { CreateMerchantDto } from './dto/create-merchant.dto';
import { CreateStaffDto, SetStaffRolesDto } from './dto/create-staff.dto';
import { AdminAnalyticsService } from './services/admin-analytics.service';
import { AdminCustomersService } from './services/admin-customers.service';
import { AdminFinanceService } from './services/admin-finance.service';
import { AdminMerchantsService } from './services/admin-merchants.service';
import { AdminOrdersService } from './services/admin-orders.service';
import { AdminUsersService } from './services/admin-users.service';

@ApiTags('Admin')
@ApiBearerAuth()
@Controller('admin')
export class AdminController {
  constructor(
    private readonly users: AdminUsersService,
    private readonly customers: AdminCustomersService,
    private readonly merchants: AdminMerchantsService,
    private readonly orders: AdminOrdersService,
    private readonly finance: AdminFinanceService,
    private readonly holdRelease: HoldReleaseService,
    private readonly analytics: AdminAnalyticsService,
  ) {}

  // ============================================================ Analytics
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.FINANCE_MANAGER)
  @Get('analytics')
  @ApiOperation({ summary: 'Платформенная аналитика (GMV, заказы, топы)' })
  analyticsSummary(@Query('range') range?: string) {
    const days = Math.min(Math.max(Number(range) || 30, 1), 365);
    return this.analytics.summary(days);
  }

  // ============================================================ Users
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.SUPPORT_AGENT)
  @Get('users')
  @ApiOperation({ summary: 'Список пользователей' })
  listUsers(
    @Query('role') role?: UserRole,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('perPage') perPage?: string,
  ) {
    return this.users.list({
      role,
      search,
      page: page ? Number(page) : 1,
      perPage: perPage ? Number(perPage) : 20,
    });
  }

  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.SUPPORT_AGENT)
  @Get('users/:id')
  @ApiOperation({ summary: 'Детали пользователя' })
  getUser(@Param('id', ParseUUIDPipe) id: string) {
    return this.users.get(id);
  }

  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @Patch('users/:id/status')
  @ApiOperation({ summary: 'Активировать / заблокировать' })
  setUserStatus(@Param('id', ParseUUIDPipe) id: string, @Body() body: { isActive: boolean }) {
    if (typeof body.isActive !== 'boolean') throw new BadRequestException('isActive required');
    return this.users.setActive(id, body.isActive);
  }

  // ==================================================== System users (staff)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @Get('staff')
  @ApiOperation({ summary: 'Системные пользователи (сотрудники платформы)' })
  listStaff(
    @Query('role') role?: UserRole,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('perPage') perPage?: string,
  ) {
    return this.users.listStaff({
      role,
      search,
      page: page ? Number(page) : 1,
      perPage: perPage ? Number(perPage) : 50,
    });
  }

  @Roles(UserRole.SUPER_ADMIN)
  @Post('staff')
  @ApiOperation({ summary: 'Создать системного пользователя (только SUPER_ADMIN)' })
  createStaff(@Body() dto: CreateStaffDto, @CurrentUser() admin: AuthenticatedUser) {
    return this.users.createStaff(dto, admin.id);
  }

  @Roles(UserRole.SUPER_ADMIN)
  @Patch('staff/:id/roles')
  @ApiOperation({ summary: 'Изменить роли сотрудника (только SUPER_ADMIN)' })
  setStaffRoles(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetStaffRolesDto,
    @CurrentUser() admin: AuthenticatedUser,
  ) {
    return this.users.setStaffRoles(id, dto.roles, admin.id);
  }

  // ============================================================ Customers
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.SUPPORT_AGENT)
  @Get('customers')
  @ApiOperation({ summary: 'Клиенты (с агрегатами заказов)' })
  listCustomers(
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('perPage') perPage?: string,
  ) {
    return this.customers.list({
      search,
      page: page ? Number(page) : 1,
      perPage: perPage ? Number(perPage) : 30,
    });
  }

  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.SUPPORT_AGENT)
  @Get('customers/:id')
  @ApiOperation({ summary: 'Карточка клиента' })
  getCustomer(@Param('id', ParseUUIDPipe) id: string) {
    return this.customers.get(id);
  }

  // ============================================================ Merchants
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.FINANCE_MANAGER, UserRole.SUPPORT_AGENT)
  @Get('merchants')
  @ApiOperation({ summary: 'Список мерчантов с фильтрами' })
  listMerchants(
    @Query('status') status?: MerchantStatus,
    @Query('verificationStatus') verificationStatus?: VerificationStatus,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('perPage') perPage?: string,
  ) {
    return this.merchants.list({
      status,
      verificationStatus,
      search,
      page: page ? Number(page) : 1,
      perPage: perPage ? Number(perPage) : 20,
    });
  }

  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @Post('merchants')
  @ApiOperation({ summary: 'Создать мерчанта (владелец + компания), сразу ACTIVE' })
  createMerchant(@Body() dto: CreateMerchantDto, @CurrentUser() user: AuthenticatedUser) {
    return this.merchants.create(dto, user.id);
  }

  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.FINANCE_MANAGER)
  @Get('merchants/:id')
  @ApiOperation({ summary: 'Детали мерчанта' })
  getMerchant(@Param('id', ParseUUIDPipe) id: string) {
    return this.merchants.get(id);
  }

  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.FINANCE_MANAGER)
  @Patch('merchants/:id/commission')
  @ApiOperation({ summary: 'Установить ставку комиссии мерчанта (%)' })
  setMerchantCommission(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { commissionRate: number },
  ) {
    if (typeof body.commissionRate !== 'number') {
      throw new BadRequestException('commissionRate must be a number');
    }
    return this.merchants.setCommission(id, body.commissionRate);
  }

  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @Post('merchants/:id/approve')
  @ApiOperation({ summary: 'Одобрить (PENDING → ACTIVE)' })
  approveMerchant(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: { notes?: string },
  ) {
    return this.merchants.approve(id, user.id, body.notes);
  }

  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @Post('merchants/:id/reject')
  @ApiOperation({ summary: 'Отклонить верификацию' })
  rejectMerchant(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: { reason: string },
  ) {
    return this.merchants.reject(id, user.id, body.reason);
  }

  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @Post('merchants/:id/suspend')
  @ApiOperation({ summary: 'Приостановить' })
  suspendMerchant(@Param('id', ParseUUIDPipe) id: string, @Body() body: { until?: string }) {
    return this.merchants.suspend(id, body.until ? new Date(body.until) : undefined);
  }

  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @Post('merchants/:id/ban')
  @ApiOperation({ summary: 'Заблокировать (BANNED)' })
  banMerchant(@Param('id', ParseUUIDPipe) id: string) {
    return this.merchants.ban(id);
  }

  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.CONTENT_MANAGER)
  @Get('merchants/:id/documents')
  @ApiOperation({ summary: 'Документы мерчанта' })
  listDocs(@Param('id', ParseUUIDPipe) id: string) {
    return this.merchants.listDocuments(id);
  }

  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @Patch('merchants/:id/documents/:docId')
  @ApiOperation({ summary: 'Одобрить/отклонить документ' })
  reviewDoc(
    @Param('id', ParseUUIDPipe) _id: string,
    @Param('docId', ParseUUIDPipe) docId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: { status: DocumentStatus; notes?: string },
  ) {
    return this.merchants.reviewDocument(docId, user.id, body.status, body.notes);
  }

  // ============================================================ Orders
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.FINANCE_MANAGER, UserRole.SUPPORT_AGENT)
  @Get('orders')
  @ApiOperation({ summary: 'Все заказы платформы' })
  listOrders(
    @Query('status') status?: OrderStatus,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('perPage') perPage?: string,
  ) {
    return this.orders.list({
      status,
      search,
      page: page ? Number(page) : 1,
      perPage: perPage ? Number(perPage) : 20,
    });
  }

  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.FINANCE_MANAGER, UserRole.SUPPORT_AGENT)
  @Get('orders/:id')
  @ApiOperation({ summary: 'Детали заказа' })
  getOrder(@Param('id', ParseUUIDPipe) id: string) {
    return this.orders.get(id);
  }

  // ============================================================ Finance
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.FINANCE_MANAGER)
  @Get('finance/dashboard')
  @ApiOperation({ summary: 'Финансовый дашборд' })
  financeDashboard() {
    return this.finance.dashboard();
  }

  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.FINANCE_MANAGER)
  @Get('finance/withdrawals')
  @ApiOperation({ summary: 'Заявки на вывод' })
  listWithdrawals(
    @Query('status') status?: WithdrawalStatus,
    @Query('page') page?: string,
    @Query('perPage') perPage?: string,
  ) {
    return this.finance.listWithdrawals({
      status,
      page: page ? Number(page) : 1,
      perPage: perPage ? Number(perPage) : 20,
    });
  }

  @Roles(UserRole.SUPER_ADMIN, UserRole.FINANCE_MANAGER)
  @Post('finance/withdrawals/:id/approve')
  @ApiOperation({ summary: 'Одобрить заявку' })
  approveWithdrawal(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: { notes?: string },
  ) {
    return this.finance.approveWithdrawal(id, user.id, body.notes);
  }

  @Roles(UserRole.SUPER_ADMIN, UserRole.FINANCE_MANAGER)
  @Post('finance/withdrawals/:id/reject')
  @ApiOperation({ summary: 'Отклонить + вернуть сумму на available_balance' })
  rejectWithdrawal(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: { reason: string },
  ) {
    return this.finance.rejectWithdrawal(id, user.id, body.reason);
  }

  @Roles(UserRole.SUPER_ADMIN, UserRole.FINANCE_MANAGER)
  @Post('finance/withdrawals/:id/complete')
  @ApiOperation({ summary: 'Отметить выплату как выполненную' })
  completeWithdrawal(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: { externalTransactionId: string },
  ) {
    if (!body.externalTransactionId)
      throw new BadRequestException('externalTransactionId required');
    return this.finance.completeWithdrawal(id, user.id, body.externalTransactionId);
  }

  @Roles(UserRole.SUPER_ADMIN, UserRole.FINANCE_MANAGER)
  @Post('finance/hold-release/run')
  @ApiOperation({
    summary: 'Запустить cron hold-release вручную (pending → available после холда)',
  })
  runHoldRelease() {
    return this.holdRelease.releaseEligible();
  }
}
