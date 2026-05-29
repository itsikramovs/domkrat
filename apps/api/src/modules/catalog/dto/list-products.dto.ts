import { ApiPropertyOptional } from '@nestjs/swagger';
import { ProductStatus } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';

export enum ProductSort {
  NEW = 'new',
  PRICE_ASC = 'price_asc',
  PRICE_DESC = 'price_desc',
  RATING = 'rating',
  POPULAR = 'popular',
}

export class ListProductsDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20, maximum: 100 })
  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  @Max(100)
  perPage?: number = 20;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  brandId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  merchantId?: string;

  @ApiPropertyOptional({ enum: ProductStatus, description: 'Только для админ-модерации' })
  @IsOptional()
  @IsEnum(ProductStatus)
  status?: ProductStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => Number(value))
  priceMin?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => Number(value))
  priceMax?: number;

  @ApiPropertyOptional({ description: 'Полнотекстовый поиск (name + oem + sku)' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ enum: ProductSort, default: ProductSort.POPULAR })
  @IsOptional()
  @IsEnum(ProductSort)
  sort?: ProductSort = ProductSort.POPULAR;

  @ApiPropertyOptional({ description: 'Slug категории (альтернатива categoryId)' })
  @IsOptional()
  @IsString()
  categorySlug?: string;

  @ApiPropertyOptional({ description: 'Slug бренда (альтернатива brandId)' })
  @IsOptional()
  @IsString()
  brandSlug?: string;

  @ApiPropertyOptional({ description: 'Только избранные (главная)' })
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true' || value === '1')
  @IsBoolean()
  featured?: boolean;

  @ApiPropertyOptional({ description: 'Только со скидкой' })
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true' || value === '1')
  @IsBoolean()
  onSale?: boolean;

  @ApiPropertyOptional({ description: 'Только новинки' })
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true' || value === '1')
  @IsBoolean()
  isNew?: boolean;

  @ApiPropertyOptional({ description: 'Совместимо с маркой' })
  @IsOptional()
  @IsUUID()
  carMakeId?: string;

  @ApiPropertyOptional({ description: 'Совместимо с моделью' })
  @IsOptional()
  @IsUUID()
  carModelId?: string;

  @ApiPropertyOptional({ description: 'Совместимо с модификацией' })
  @IsOptional()
  @IsUUID()
  carModificationId?: string;
}
