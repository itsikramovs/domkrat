import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, IsString, Length, Matches, ValidateNested } from 'class-validator';

import { OptionalMultiLangTextDto } from './multilang.dto';

export class CreateBrandDto {
  @ApiProperty({ example: 'Bosch' })
  @IsString()
  @Length(1, 200)
  name!: string;

  @ApiProperty({ example: 'bosch' })
  @IsString()
  @Length(1, 100)
  @Matches(/^[a-z0-9-]+$/)
  slug!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  logoUrl?: string;

  @ApiPropertyOptional({ type: OptionalMultiLangTextDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => OptionalMultiLangTextDto)
  description?: OptionalMultiLangTextDto;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  countryOfOrigin?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  website?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  position?: number;
}

export class UpdateBrandDto extends PartialType(CreateBrandDto) {}
