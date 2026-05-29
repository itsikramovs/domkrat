import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PromoDiscountType } from '@prisma/client';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Min,
} from 'class-validator';

export class CreatePromoCodeDto {
  @ApiProperty({ example: 'WELCOME10', description: 'Код (будет нормализован в UPPERCASE)' })
  @IsString()
  @Length(3, 40)
  code!: string;

  @ApiPropertyOptional({ description: 'Описание { ru, uz }' })
  @IsOptional()
  description?: Record<string, string>;

  @ApiProperty({ enum: PromoDiscountType })
  @IsEnum(PromoDiscountType)
  discountType!: PromoDiscountType;

  @ApiProperty({ description: 'Для PERCENTAGE — проценты (1–100); для FIXED — сумма в UZS' })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  discountValue!: number;

  @ApiPropertyOptional({ description: 'Макс. сумма скидки (для PERCENTAGE)' })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  maxDiscountAmount?: number;

  @ApiPropertyOptional({ description: 'Минимальная сумма заказа' })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  minOrderAmount?: number;

  @ApiPropertyOptional({ description: 'Лимит использований всего (null — без лимита)' })
  @IsOptional()
  @IsInt()
  @Min(1)
  usageLimit?: number;

  @ApiPropertyOptional({ description: 'Лимит использований на пользователя' })
  @IsOptional()
  @IsInt()
  @Min(1)
  perUserLimit?: number;

  @ApiProperty({ description: 'Действует с (ISO 8601)' })
  @IsISO8601()
  validFrom!: string;

  @ApiProperty({ description: 'Действует по (ISO 8601)' })
  @IsISO8601()
  validUntil!: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({
    description: 'UUID категорий, к которым применим (пусто — все)',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  applicableCategories?: string[];

  @ApiPropertyOptional({
    description: 'UUID мерчантов, к которым применим (пусто — все)',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  applicableMerchants?: string[];
}
