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

class ReceiptItemInput {
  @ApiProperty()
  @IsUUID()
  productId!: string;

  @ApiProperty({ example: 100 })
  @IsInt()
  @Min(1)
  expectedQuantity!: number;

  @ApiPropertyOptional({ example: '85000.00', description: 'Закупочная цена за единицу' })
  @IsOptional()
  @IsString()
  unitCost?: string;
}

/** Шаг 1: создание приёмки (DRAFT). */
export class CreateReceiptDto {
  @ApiProperty()
  @IsUUID()
  warehouseId!: string;

  @ApiPropertyOptional({ example: '2026-06-01T10:00:00Z' })
  @IsOptional()
  @IsString()
  expectedAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiProperty({ type: [ReceiptItemInput] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ReceiptItemInput)
  items!: ReceiptItemInput[];
}

class ReceivedItemInput {
  @ApiProperty({ description: 'ID строки приёмки (StockReceiptItem)' })
  @IsUUID()
  itemId!: string;

  @ApiProperty({ example: 98, description: 'Фактически принято' })
  @IsInt()
  @Min(0)
  receivedQuantity!: number;
}

/** Шаг 3: приёмка по факту (ARRIVED) — сверка ожидалось/принято. */
export class ReceiveItemsDto {
  @ApiProperty({ type: [ReceivedItemInput] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ReceivedItemInput)
  items!: ReceivedItemInput[];
}

class QualityCheckItemInput {
  @ApiProperty()
  @IsUUID()
  itemId!: string;

  @ApiProperty({ example: 96, description: 'Принято после проверки' })
  @IsInt()
  @Min(0)
  acceptedQuantity!: number;

  @ApiProperty({ example: 2, description: 'Брак' })
  @IsInt()
  @Min(0)
  rejectedQuantity!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  rejectionReason?: string;
}

/** Шаг 4: контроль качества (CHECKING) — accepted/rejected. */
export class QualityCheckDto {
  @ApiProperty({ type: [QualityCheckItemInput] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => QualityCheckItemInput)
  items!: QualityCheckItemInput[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

class PlacementInput {
  @ApiProperty({ description: 'ID строки приёмки' })
  @IsUUID()
  itemId!: string;

  @ApiProperty({ description: 'Ячейка размещения' })
  @IsUUID()
  cellId!: string;

  @ApiProperty({ example: 96 })
  @IsInt()
  @Min(1)
  quantity!: number;
}

/** Шаг 6: размещение по ячейкам (PLACING → COMPLETED). */
export class PlacementDto {
  @ApiProperty({ type: [PlacementInput] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PlacementInput)
  placements!: PlacementInput[];
}
