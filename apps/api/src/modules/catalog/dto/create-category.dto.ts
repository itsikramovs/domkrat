import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, IsString, IsUUID, Length, Matches, ValidateNested } from 'class-validator';

import { MultiLangTextDto, OptionalMultiLangTextDto } from './multilang.dto';

export class CreateCategoryDto {
  @ApiProperty({ type: MultiLangTextDto })
  @ValidateNested()
  @Type(() => MultiLangTextDto)
  name!: MultiLangTextDto;

  @ApiProperty({ example: 'brake-system' })
  @IsString()
  @Length(1, 100)
  @Matches(/^[a-z0-9-]+$/, { message: 'Slug must be lowercase letters, digits and hyphens' })
  slug!: string;

  @ApiPropertyOptional({ type: OptionalMultiLangTextDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => OptionalMultiLangTextDto)
  description?: OptionalMultiLangTextDto;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  parentId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  iconUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  imageUrl?: string;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsInt()
  position?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateCategoryDto extends PartialType(CreateCategoryDto) {}
