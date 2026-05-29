import { BadRequestException, Body, Controller, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';

import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { Roles } from '../../auth/decorators/roles.decorator';
import type { AuthenticatedUser } from '../../auth/types';
import { ProductsService } from '../../catalog/services/products.service';
import { mimeToExt, PresignBannerImageDto, PresignProductImageDto } from '../dto/presign.dto';
import { StorageService } from '../services/storage.service';

@ApiTags('Uploads')
@ApiBearerAuth()
@Controller('uploads')
export class UploadsController {
  constructor(
    private readonly storage: StorageService,
    private readonly products: ProductsService,
  ) {}

  @Post('presign-product-image')
  @Roles(UserRole.MERCHANT, UserRole.MERCHANT_STAFF, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Presigned PUT URL для загрузки изображения товара' })
  async presign(@CurrentUser() user: AuthenticatedUser, @Body() dto: PresignProductImageDto) {
    if (
      !user.merchantId &&
      !user.roles.some((r) => r === UserRole.ADMIN || r === UserRole.SUPER_ADMIN)
    ) {
      throw new BadRequestException('User is not linked to a merchant');
    }
    // Проверка владения товаром (для merchant)
    if (user.merchantId) {
      await this.products.assertOwnership(user.merchantId, dto.productId);
    }
    const ext = mimeToExt(dto.contentType);
    if (!ext) throw new BadRequestException('Unsupported content type');
    return this.storage.presignProductImage({
      productId: dto.productId,
      contentType: dto.contentType,
      extension: ext,
    });
  }

  @Post('presign-banner-image')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.CONTENT_MANAGER)
  @ApiOperation({ summary: 'Presigned PUT URL для загрузки изображения баннера' })
  async presignBanner(@Body() dto: PresignBannerImageDto) {
    const ext = mimeToExt(dto.contentType);
    if (!ext) throw new BadRequestException('Unsupported content type');
    return this.storage.presignBannerImage({ contentType: dto.contentType, extension: ext });
  }
}
