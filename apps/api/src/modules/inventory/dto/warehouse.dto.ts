import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CellType, WarehouseType } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Length,
  Min,
} from 'class-validator';

/** Мультиязычное имя { ru, uz } */
class LocalizedName {
  @ApiProperty({ example: 'Главный склад' })
  @IsString()
  ru!: string;

  @ApiProperty({ example: 'Asosiy ombor' })
  @IsString()
  uz!: string;
}

export class CreateWarehouseDto {
  @ApiProperty({ example: 'WH-TASHKENT-1' })
  @IsString()
  @Length(2, 50)
  code!: string;

  @ApiProperty({ type: LocalizedName })
  @IsObject()
  @Type(() => LocalizedName)
  name!: LocalizedName;

  @ApiProperty({ enum: WarehouseType, example: WarehouseType.MERCHANT })
  @IsEnum(WarehouseType)
  type!: WarehouseType;

  @ApiPropertyOptional({ example: 'Ташкент, ул. Складская, 1' })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({ example: 'Ташкент' })
  @IsOptional()
  @IsString()
  region?: string;

  @ApiPropertyOptional({ example: 'Ташкент' })
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional({ example: '+998712000000' })
  @IsOptional()
  @IsString()
  contactPhone?: string;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  isPickupPoint?: boolean;
}

export class UpdateWarehouseDto {
  @ApiPropertyOptional({ type: LocalizedName })
  @IsOptional()
  @IsObject()
  name?: LocalizedName;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  region?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  contactPhone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isPickupPoint?: boolean;
}

// --------- Иерархия: zone → rack → shelf → cell ---------

export class CreateZoneDto {
  @ApiProperty({ example: 'A' })
  @IsString()
  @Length(1, 20)
  code!: string;

  @ApiProperty({ type: LocalizedName })
  @IsObject()
  name!: LocalizedName;

  @ApiPropertyOptional({ description: 'Ограничения по категориям (slug)' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  categoryRestrictions?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isHazardous?: boolean;
}

export class CreateRackDto {
  @ApiProperty({ example: 'R1' })
  @IsString()
  @Length(1, 20)
  code!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  maxWeightKg?: number;
}

export class CreateShelfDto {
  @ApiProperty({ example: 'S1' })
  @IsString()
  @Length(1, 20)
  code!: string;

  @ApiProperty({ example: 1 })
  @IsInt()
  @Min(0)
  level!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  maxWeightKg?: number;
}

export class CreateCellDto {
  @ApiProperty({ example: 'A-R1-S1-01', description: 'Глобально уникальный код ячейки' })
  @IsString()
  @Length(2, 60)
  code!: string;

  @ApiProperty({ enum: CellType, example: CellType.STANDARD })
  @IsEnum(CellType)
  cellType!: CellType;

  @ApiPropertyOptional({ description: 'Закрепить ячейку за мерчантом (аренда)' })
  @IsOptional()
  @IsString()
  merchantId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  maxWeightKg?: number;

  @ApiPropertyOptional({ description: 'QR-код ячейки (если печатаете)' })
  @IsOptional()
  @IsString()
  qrCode?: string;
}
