import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsUUID, Min, ValidateIf } from 'class-validator';

/** Перемещение остатка между ячейками (StockMovement TRANSFER). */
export class TransferDto {
  @ApiPropertyOptional({ description: 'Предложение продавца (новый способ)' })
  @IsOptional()
  @IsUUID()
  offerId?: string;

  @ApiPropertyOptional({ description: 'Товар (legacy) — берётся основное предложение продавца' })
  @ValidateIf((o: TransferDto) => !o.offerId)
  @IsUUID()
  productId?: string;

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
