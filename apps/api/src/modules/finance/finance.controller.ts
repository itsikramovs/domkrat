import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Query,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString, Length, Min } from 'class-validator';

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import type { AuthenticatedUser } from '../auth/types';

import { FinanceService } from './finance.service';

export class CreateWithdrawalDto {
  @IsNumber()
  @Min(1)
  amount!: number;

  @IsString()
  @Length(1, 50)
  bankAccount!: string;

  @IsString()
  @Length(1, 255)
  bankName!: string;

  @IsOptional()
  @IsString()
  bankMfo?: string;

  @IsString()
  @Length(1, 255)
  recipientName!: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

@ApiTags('Merchant · Finance')
@ApiBearerAuth()
@Roles(UserRole.MERCHANT, UserRole.MERCHANT_STAFF)
@Controller('merchant')
export class MerchantFinanceController {
  constructor(private readonly finance: FinanceService) {}

  @Get('balance')
  @ApiOperation({ summary: 'Балансы мерчанта' })
  getBalance(@CurrentUser() user: AuthenticatedUser) {
    this.requireMerchant(user);
    return this.finance.getBalance(user.merchantId!);
  }

  @Get('transactions')
  @ApiOperation({ summary: 'История транзакций' })
  listTransactions(
    @CurrentUser() user: AuthenticatedUser,
    @Query('page') page?: string,
    @Query('perPage') perPage?: string,
  ) {
    this.requireMerchant(user);
    return this.finance.listTransactions(
      user.merchantId!,
      page ? Number(page) : 1,
      perPage ? Number(perPage) : 50,
    );
  }

  @Get('withdrawals')
  @ApiOperation({ summary: 'Запросы на вывод' })
  listWithdrawals(@CurrentUser() user: AuthenticatedUser) {
    this.requireMerchant(user);
    return this.finance.listWithdrawals(user.merchantId!);
  }

  @Post('withdrawals')
  @ApiOperation({ summary: 'Запросить вывод средств' })
  createWithdrawal(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateWithdrawalDto) {
    this.requireMerchant(user);
    return this.finance.createWithdrawal(user.merchantId!, dto);
  }

  private requireMerchant(user: AuthenticatedUser): void {
    if (!user.merchantId) throw new BadRequestException('User is not linked to a merchant');
  }
}
