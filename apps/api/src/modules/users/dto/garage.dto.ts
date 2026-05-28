import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { FuelType, Transmission } from '@prisma/client';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
} from 'class-validator';

export class CreateGarageDto {
  @ApiPropertyOptional({ example: 'Моя ласточка' })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  nickname?: string;

  @ApiPropertyOptional({ description: 'VIN — 17 знаков' })
  @IsOptional()
  @IsString()
  @Length(17, 17)
  vin?: string;

  @ApiPropertyOptional({ description: 'UUID модификации авто (car_modifications.id)' })
  @IsOptional()
  @IsString()
  carModificationId?: string;

  @ApiPropertyOptional({ example: 2010 })
  @IsOptional()
  @IsInt()
  @Min(1900)
  @Max(2100)
  year?: number;

  @ApiPropertyOptional({ example: '01A123BB' })
  @IsOptional()
  @IsString()
  @Length(1, 20)
  licensePlate?: string;

  @ApiPropertyOptional({ example: 125000 })
  @IsOptional()
  @IsInt()
  @Min(0)
  mileage?: number;

  @ApiPropertyOptional({ example: 2.4 })
  @IsOptional()
  @IsNumber()
  engineVolume?: number;

  @ApiPropertyOptional({ enum: FuelType })
  @IsOptional()
  @IsEnum(FuelType)
  fuelType?: FuelType;

  @ApiPropertyOptional({ enum: Transmission })
  @IsOptional()
  @IsEnum(Transmission)
  transmission?: Transmission;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;
}

export class UpdateGarageDto extends PartialType(CreateGarageDto) {}
