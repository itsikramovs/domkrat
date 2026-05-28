import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ReviewStatus, UserRole } from '@prisma/client';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import type { AuthenticatedUser } from '../auth/types';

import { CreateReviewDto, MerchantReplyDto, ModerateReviewDto } from './dto/create-review.dto';
import { ReviewsService } from './reviews.service';

@ApiTags('Reviews')
@Controller()
export class ReviewsController {
  constructor(private readonly reviews: ReviewsService) {}

  // ---- Public ----
  @Public()
  @Get('products/:slug/reviews')
  @ApiOperation({ summary: 'Отзывы товара (APPROVED only)' })
  listPublic(@Param('slug') slug: string) {
    return this.reviews.listPublic(slug);
  }

  // ---- Customer ----
  @ApiBearerAuth()
  @Roles(UserRole.CUSTOMER)
  @Post('products/:id/reviews')
  @ApiOperation({ summary: 'Оставить отзыв (только для verified purchase)' })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) productId: string,
    @Body() dto: CreateReviewDto,
  ) {
    return this.reviews.create(user.id, productId, dto);
  }

  // ---- Merchant ----
  @ApiBearerAuth()
  @Roles(UserRole.MERCHANT, UserRole.MERCHANT_STAFF)
  @Get('merchant/reviews')
  @ApiOperation({ summary: 'Отзывы на товары мерчанта' })
  listMerchant(@CurrentUser() user: AuthenticatedUser) {
    if (!user.merchantId) throw new BadRequestException('Not a merchant');
    return this.reviews.listForMerchant(user.merchantId);
  }

  @ApiBearerAuth()
  @Roles(UserRole.MERCHANT, UserRole.MERCHANT_STAFF)
  @Post('merchant/reviews/:id/reply')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Ответить на отзыв' })
  reply(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: MerchantReplyDto,
  ) {
    if (!user.merchantId) throw new BadRequestException('Not a merchant');
    return this.reviews.reply(user.merchantId, id, dto);
  }

  // ---- Admin ----
  @ApiBearerAuth()
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.CONTENT_MANAGER, UserRole.SUPPORT_AGENT)
  @Get('admin/reviews')
  @ApiOperation({ summary: 'Все отзывы (модерация)' })
  listAdmin(
    @Query('status') status?: ReviewStatus,
    @Query('page') page?: string,
    @Query('perPage') perPage?: string,
  ) {
    return this.reviews.listForAdmin({
      status,
      page: page ? Number(page) : 1,
      perPage: perPage ? Number(perPage) : 20,
    });
  }

  @ApiBearerAuth()
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.CONTENT_MANAGER)
  @Patch('admin/reviews/:id/moderate')
  @ApiOperation({ summary: 'Модерация: APPROVED / REJECTED' })
  moderate(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ModerateReviewDto,
  ) {
    return this.reviews.moderate(id, user.id, dto.status);
  }
}
