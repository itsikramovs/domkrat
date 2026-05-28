import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DeliveryMethodType, PaymentMethod } from '@prisma/client';
import { IsBoolean, IsEnum, IsOptional, IsString, IsUUID, Length } from 'class-validator';

export class CreateOrderDto {
  @ApiProperty({ description: 'UUID адреса доставки (или null для самовывоза)' })
  @IsOptional()
  @IsUUID()
  deliveryAddressId?: string;

  @ApiProperty({ enum: DeliveryMethodType })
  @IsEnum(DeliveryMethodType)
  deliveryMethod!: DeliveryMethodType;

  @ApiPropertyOptional({ description: 'UUID пункта выдачи (для SELF_PICKUP)' })
  @IsOptional()
  @IsUUID()
  pickupPointId?: string;

  @ApiProperty({ enum: PaymentMethod })
  @IsEnum(PaymentMethod)
  paymentMethod!: PaymentMethod;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  promoCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  customerNotes?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isLegalEntity?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, 50)
  taxId?: string;
}
