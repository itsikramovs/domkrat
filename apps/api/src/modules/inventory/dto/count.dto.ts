import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';

export class CreateStockCountDto {
  @ApiProperty({ description: 'Склад для инвентаризации' })
  @IsUUID()
  warehouseId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;
}

export class SaveCountItemDto {
  @ApiProperty()
  @IsUUID()
  itemId!: string;

  @ApiProperty({ example: 12, description: 'Фактически пересчитано' })
  @IsInt()
  @Min(0)
  countedQty!: number;
}

export class SaveStockCountDto {
  @ApiProperty({ type: [SaveCountItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => SaveCountItemDto)
  items!: SaveCountItemDto[];
}
