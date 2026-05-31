import { ApiProperty, ApiPropertyOptional, OmitType, PartialType } from '@nestjs/swagger';
import { ProductOfferStatus } from '@prisma/client';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Min,
} from 'class-validator';

/** Предложение продавца на конкретный вариант товара: цена + продавец (мультипродавец). */
export class CreateProductOfferDto {
  @ApiProperty({ description: 'Вариант, на который заводится предложение' })
  @IsUUID()
  variantId!: string;

  @ApiProperty({ description: 'Продавец' })
  @IsUUID()
  merchantId!: string;

  @ApiProperty({ example: 'BOSCH-1457433721' })
  @IsString()
  @Length(1, 100)
  sku!: string;

  @ApiProperty({ example: 85000 })
  @IsNumber()
  @Min(0)
  price!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  compareAtPrice?: number;

  @ApiPropertyOptional({ description: 'Себестоимость единицы (учёт)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  costPrice?: number;

  @ApiPropertyOptional({ default: 12 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  vatRate?: number;

  @ApiPropertyOptional({ default: 'UZS' })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiPropertyOptional({ enum: ProductOfferStatus })
  @IsOptional()
  @IsEnum(ProductOfferStatus)
  status?: ProductOfferStatus;
}

/** Обновление предложения: цена/себестоимость/НДС/статус (продавец и вариант не меняются). */
export class UpdateProductOfferDto extends PartialType(
  OmitType(CreateProductOfferDto, ['variantId', 'merchantId'] as const),
) {}

export class SetOfferStatusDto {
  @ApiProperty({ enum: ProductOfferStatus })
  @IsEnum(ProductOfferStatus)
  status!: ProductOfferStatus;
}

/** Массовое изменение своих предложений (цена и/или статус). */
export class BulkOfferDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('all', { each: true })
  offerIds!: string[];

  @ApiPropertyOptional({ description: 'Новая цена для всех выбранных' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  price?: number;

  @ApiPropertyOptional({ enum: ProductOfferStatus })
  @IsOptional()
  @IsEnum(ProductOfferStatus)
  status?: ProductOfferStatus;
}

/** Импорт прайс-листа CSV (sku,name,price,vatRate,status) — фронт читает файл как текст. */
export class ImportOffersCsvDto {
  @ApiProperty({ description: 'Содержимое CSV' })
  @IsString()
  csv!: string;
}
