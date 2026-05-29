import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { BannerPosition } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  ValidateNested,
} from 'class-validator';

import { MultiLangTextDto, OptionalMultiLangTextDto } from '../../catalog/dto/multilang.dto';

export class CreateBannerDto {
  @ApiProperty({ type: MultiLangTextDto })
  @ValidateNested()
  @Type(() => MultiLangTextDto)
  title!: MultiLangTextDto;

  @ApiPropertyOptional({ type: OptionalMultiLangTextDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => OptionalMultiLangTextDto)
  subtitle?: OptionalMultiLangTextDto;

  @ApiProperty({ description: 'URL картинки (desktop)' })
  @IsString()
  @Length(1, 1000)
  imageUrlDesktop!: string;

  @ApiPropertyOptional({ description: 'URL картинки (mobile)' })
  @IsOptional()
  @IsString()
  @Length(1, 1000)
  imageUrlMobile?: string;

  @ApiPropertyOptional({ description: 'Куда ведёт баннер' })
  @IsOptional()
  @IsString()
  @Length(1, 1000)
  linkUrl?: string;

  @ApiProperty({ enum: BannerPosition })
  @IsEnum(BannerPosition)
  position!: BannerPosition;

  @ApiPropertyOptional({ description: 'Категория (для CATEGORY_TOP)' })
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsInt()
  sortOrder?: number;

  @ApiProperty({ example: '2026-05-29T00:00:00.000Z' })
  @IsISO8601()
  validFrom!: string;

  @ApiPropertyOptional({ example: '2026-12-31T23:59:59.000Z' })
  @IsOptional()
  @IsISO8601()
  validUntil?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateBannerDto extends PartialType(CreateBannerDto) {}
