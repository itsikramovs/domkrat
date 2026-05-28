import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsBoolean,
  IsLatitude,
  IsLongitude,
  IsOptional,
  IsString,
  Length,
} from 'class-validator';

export class CreateAddressDto {
  @ApiPropertyOptional({ example: 'Дом' })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  title?: string;

  @ApiProperty({ example: 'Иван Петров' })
  @IsString()
  @Length(1, 200)
  recipientName!: string;

  @ApiProperty({ example: '+998901111111' })
  @IsString()
  @Length(1, 20)
  recipientPhone!: string;

  @ApiProperty({ example: 'Ташкент' })
  @IsString()
  @Length(1, 100)
  region!: string;

  @ApiProperty({ example: 'Ташкент' })
  @IsString()
  @Length(1, 100)
  city!: string;

  @ApiPropertyOptional({ example: 'Юнусабад' })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  district?: string;

  @ApiProperty({ example: 'ул. Амира Темура, 15, кв. 42' })
  @IsString()
  @Length(1, 500)
  addressLine!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, 500)
  landmark?: string;

  @ApiPropertyOptional({ example: 41.3 })
  @IsOptional()
  @IsLatitude()
  latitude?: number;

  @ApiPropertyOptional({ example: 69.27 })
  @IsOptional()
  @IsLongitude()
  longitude?: number;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isLegalEntity?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  companyName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  taxId?: string;
}

export class UpdateAddressDto extends PartialType(CreateAddressDto) {}
