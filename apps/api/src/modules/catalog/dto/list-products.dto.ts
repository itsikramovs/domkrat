import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';

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
}
