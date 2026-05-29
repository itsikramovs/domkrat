import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ProductStatus } from '@prisma/client';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Min,
  ValidateNested,
} from 'class-validator';

import { MultiLangTextDto, OptionalMultiLangTextDto } from './multilang.dto';

/** Значение одной характеристики товара. Заполняется в зависимости от dataType атрибута. */
export class ProductAttributeValueDto {
  @ApiProperty()
  @IsUUID()
  attributeId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  valueString?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  valueNumber?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  valueBoolean?: boolean;

  @ApiPropertyOptional({ description: 'Код выбранной опции (для ENUM)' })
  @IsOptional()
  @IsString()
  valueEnum?: string;

  @ApiPropertyOptional({ type: [String], description: 'Коды опций (для MULTI_ENUM)' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  valueMultiEnum?: string[];
}

export class CreateProductDto {
  @ApiProperty({ type: MultiLangTextDto })
  @ValidateNested()
  @Type(() => MultiLangTextDto)
  name!: MultiLangTextDto;

  @ApiProperty({ example: 'BOSCH-1457433721' })
  @IsString()
  @Length(1, 100)
  sku!: string;

  @ApiPropertyOptional({ description: 'URL slug; если не указан — генерируется из name.ru' })
  @IsOptional()
  @IsString()
  @Length(1, 255)
  slug?: string;

  @ApiProperty()
  @IsUUID()
  categoryId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  brandId?: string;

  @ApiPropertyOptional({ type: OptionalMultiLangTextDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => OptionalMultiLangTextDto)
  description?: OptionalMultiLangTextDto;

  @ApiPropertyOptional({ type: OptionalMultiLangTextDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => OptionalMultiLangTextDto)
  shortDescription?: OptionalMultiLangTextDto;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  oemNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  barcode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  manufacturerPartNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  weight?: number;

  @ApiProperty({ example: 85000 })
  @IsNumber()
  @Min(0)
  price!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  compareAtPrice?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  vatRate?: number;

  @ApiPropertyOptional({ enum: ProductStatus, default: ProductStatus.DRAFT })
  @IsOptional()
  @IsEnum(ProductStatus)
  status?: ProductStatus;

  @ApiPropertyOptional({ type: [ProductAttributeValueDto], description: 'Характеристики товара' })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductAttributeValueDto)
  attributes?: ProductAttributeValueDto[];
}

export class UpdateProductDto extends PartialType(CreateProductDto) {}

/** Создание товара админом за конкретного мерчанта. Товар создаётся как DRAFT (не продаётся до прихода). */
export class AdminCreateProductDto extends CreateProductDto {
  @ApiProperty({ description: 'Мерчант-владелец товара' })
  @IsUUID()
  merchantId!: string;
}

/** Быстрый приход (оприходование) товара админом: приёмка → размещение на ячейку → товар становится продаваемым. */
export class ReceiveProductDto {
  @ApiProperty()
  @IsUUID()
  warehouseId!: string;

  @ApiProperty()
  @IsUUID()
  cellId!: string;

  @ApiProperty({ example: 10 })
  @IsInt()
  @Min(1)
  quantity!: number;

  @ApiPropertyOptional({ description: 'Себестоимость единицы (для учёта)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  unitCost?: number;
}

export class UpdateProductStatusDto {
  @ApiProperty({ enum: ProductStatus })
  @IsEnum(ProductStatus)
  status!: ProductStatus;
}

export class ModerateProductDto {
  @ApiProperty({ enum: [ProductStatus.ACTIVE, ProductStatus.REJECTED] })
  @IsEnum(ProductStatus)
  status!: typeof ProductStatus.ACTIVE | typeof ProductStatus.REJECTED;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reason?: string;
}
