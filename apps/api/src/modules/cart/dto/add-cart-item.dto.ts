import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsUUID, Min, ValidateIf } from 'class-validator';

export class AddCartItemDto {
  @ApiPropertyOptional({ description: 'Предложение продавца (новый способ)' })
  @IsOptional()
  @IsUUID()
  offerId?: string;

  @ApiPropertyOptional({ description: 'Товар (legacy) — кладётся по основному предложению' })
  @ValidateIf((o: AddCartItemDto) => !o.offerId)
  @IsUUID()
  productId?: string;

  @ApiProperty({ example: 1, minimum: 1 })
  @IsInt()
  @Min(1)
  quantity!: number;
}

export class UpdateCartItemDto {
  @ApiProperty({ example: 2, minimum: 1 })
  @IsInt()
  @Min(1)
  quantity!: number;
}
