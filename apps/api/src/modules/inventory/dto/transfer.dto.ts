import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsUUID, Min } from 'class-validator';

/** Перемещение остатка между ячейками (StockMovement TRANSFER). */
export class TransferDto {
  @ApiProperty()
  @IsUUID()
  productId!: string;

  @ApiProperty()
  @IsUUID()
  fromCellId!: string;

  @ApiProperty()
  @IsUUID()
  toCellId!: string;

  @ApiProperty({ example: 10 })
  @IsInt()
  @Min(1)
  quantity!: number;
}
