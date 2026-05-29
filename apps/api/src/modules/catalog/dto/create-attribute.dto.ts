import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Matches,
  ValidateNested,
} from 'class-validator';
import { AttributeDataType } from '@prisma/client';

import { MultiLangTextDto } from './multilang.dto';

const SLUG_RE = /^[a-z0-9-]+$/;

// ----------------------------- Attribute groups -----------------------------
export class CreateAttributeGroupDto {
  @ApiProperty({ type: MultiLangTextDto })
  @ValidateNested()
  @Type(() => MultiLangTextDto)
  name!: MultiLangTextDto;

  @ApiProperty({ example: 'dimensions' })
  @IsString()
  @Length(1, 100)
  @Matches(SLUG_RE, { message: 'Slug must be lowercase letters, digits and hyphens' })
  slug!: string;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsInt()
  position?: number;
}

export class UpdateAttributeGroupDto extends PartialType(CreateAttributeGroupDto) {}

// ------------------------------- Enum option --------------------------------
export class AttributeEnumValueDto {
  @ApiProperty({ example: 'red' })
  @IsString()
  @Length(1, 100)
  value!: string;

  @ApiProperty({ type: MultiLangTextDto })
  @ValidateNested()
  @Type(() => MultiLangTextDto)
  label!: MultiLangTextDto;
}

// -------------------------------- Attributes --------------------------------
export class CreateAttributeDto {
  @ApiProperty({ type: MultiLangTextDto })
  @ValidateNested()
  @Type(() => MultiLangTextDto)
  name!: MultiLangTextDto;

  @ApiProperty({ example: 'width-mm' })
  @IsString()
  @Length(1, 100)
  @Matches(SLUG_RE, { message: 'Slug must be lowercase letters, digits and hyphens' })
  slug!: string;

  @ApiProperty({ enum: AttributeDataType })
  @IsEnum(AttributeDataType)
  dataType!: AttributeDataType;

  @ApiPropertyOptional({ description: 'Внутренний код (например для интеграций)' })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  code?: string;

  @ApiPropertyOptional({ example: 'мм', description: 'Единица измерения (для NUMBER)' })
  @IsOptional()
  @IsString()
  @Length(1, 32)
  unit?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isFilterable?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isSearchable?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isRequired?: boolean;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsInt()
  position?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  attributeGroupId?: string;

  @ApiPropertyOptional({ type: [String], description: 'Категории, к которым применим атрибут' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayUnique()
  categoryIds?: string[];

  @ApiPropertyOptional({ type: [AttributeEnumValueDto], description: 'Опции для ENUM/MULTI_ENUM' })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AttributeEnumValueDto)
  enumValues?: AttributeEnumValueDto[];
}

export class UpdateAttributeDto extends PartialType(CreateAttributeDto) {}
