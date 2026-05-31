import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsOptional,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';

/** Один отбор: сколько единиц взять из конкретной ячейки (cellId=null → из неразмещённого остатка). */
export class PickCellDto {
  @ApiPropertyOptional({ description: 'Ячейка отбора; null/опущено — из неразмещённого остатка' })
  @IsOptional()
  @IsUUID()
  cellId?: string | null;

  @ApiProperty({ example: 2 })
  @IsInt()
  @Min(1)
  qty!: number;
}

/** Отбор по одной позиции заказа: сумма qty по ячейкам должна равняться количеству в позиции. */
export class PickItemDto {
  @ApiProperty()
  @IsUUID()
  orderItemId!: string;

  @ApiProperty({ type: [PickCellDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PickCellDto)
  picks!: PickCellDto[];
}

/** Подтверждение сборки суб-заказа: что и из каких ячеек физически отобрано. */
export class PickDto {
  @ApiProperty({ type: [PickItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PickItemDto)
  items!: PickItemDto[];
}
