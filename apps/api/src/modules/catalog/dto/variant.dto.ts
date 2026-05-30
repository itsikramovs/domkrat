import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, IsString, Min, ValidateNested } from 'class-validator';

import { OptionalMultiLangTextDto } from './multilang.dto';

/** Вариация товара (простой список): ярлык + позиция. У невариативного товара один дефолтный вариант. */
export class CreateProductVariantDto {
  @ApiPropertyOptional({
    type: OptionalMultiLangTextDto,
    description: 'Ярлык варианта, напр. {ru:"4 л", uz:"4 l"}. null = базовый вариант.',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => OptionalMultiLangTextDto)
  name?: OptionalMultiLangTextDto;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  barcode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  position?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

export class UpdateProductVariantDto extends PartialType(CreateProductVariantDto) {}
