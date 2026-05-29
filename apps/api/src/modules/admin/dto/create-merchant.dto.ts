import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { LegalType, MerchantType } from '@prisma/client';
import { IsEmail, IsEnum, IsOptional, IsString, Length, Matches, MaxLength } from 'class-validator';

/**
 * Создание мерчанта администратором: одновременно заводит владельца (User с ролью MERCHANT)
 * и саму компанию (Merchant, сразу ACTIVE/APPROVED, без email-верификации).
 */
export class CreateMerchantDto {
  // --------- Владелец (User) ---------
  @ApiProperty({ example: 'seller@example.com' })
  @IsEmail()
  @MaxLength(255)
  ownerEmail!: string;

  @ApiProperty({ example: 'StrongPass1!', description: 'Минимум 8 символов, буква и цифра' })
  @IsString()
  @Length(8, 100)
  @Matches(/(?=.*[A-Za-z])(?=.*\d)/, {
    message: 'Password must contain at least one letter and one number',
  })
  ownerPassword!: string;

  @ApiProperty({ example: 'Иван' })
  @IsString()
  @Length(1, 100)
  ownerFirstName!: string;

  @ApiProperty({ example: 'Петров' })
  @IsString()
  @Length(1, 100)
  ownerLastName!: string;

  @ApiPropertyOptional({ example: '+998901234567' })
  @IsOptional()
  @Matches(/^\+998\d{9}$/, { message: 'Phone must be in +998XXXXXXXXX format' })
  ownerPhone?: string;

  // --------- Компания (Merchant) ---------
  @ApiProperty({ enum: MerchantType, example: MerchantType.TYPE_2 })
  @IsEnum(MerchantType)
  merchantType!: MerchantType;

  @ApiProperty({ enum: LegalType, example: LegalType.LLC })
  @IsEnum(LegalType)
  legalType!: LegalType;

  @ApiProperty({ example: 'ООО «Автозапчасти»' })
  @IsString()
  @Length(2, 200)
  legalName!: string;

  @ApiProperty({ example: 'AutoParts UZ' })
  @IsString()
  @Length(2, 120)
  brandName!: string;

  @ApiPropertyOptional({
    example: 'autoparts-uz',
    description: 'Если не задан — сгенерируется из brandName и проверится на уникальность',
  })
  @IsOptional()
  @IsString()
  @Matches(/^[a-z0-9-]+$/, { message: 'Slug: только строчная латиница, цифры и дефис' })
  slug?: string;

  @ApiPropertyOptional({ example: '+998712000000' })
  @IsOptional()
  @IsString()
  contactPhone?: string;

  @ApiPropertyOptional({ example: 'info@autoparts.uz' })
  @IsOptional()
  @IsEmail()
  contactEmail?: string;

  @ApiPropertyOptional({ example: '301234567', description: 'ИНН (taxId)' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  taxId?: string;
}
