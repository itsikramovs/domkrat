import { ApiPropertyOptional } from '@nestjs/swagger';
import { Gender } from '@prisma/client';
import { IsDateString, IsEnum, IsIn, IsOptional, IsString, Length } from 'class-validator';

export class UpdateProfileDto {
  @ApiPropertyOptional({ example: 'Иван' })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  firstName?: string;

  @ApiPropertyOptional({ example: 'Петров' })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  lastName?: string;

  @ApiPropertyOptional({ example: 'Сергеевич' })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  middleName?: string;

  @ApiPropertyOptional({ example: '1990-05-15' })
  @IsOptional()
  @IsDateString()
  birthDate?: string;

  @ApiPropertyOptional({ enum: Gender })
  @IsOptional()
  @IsEnum(Gender)
  gender?: Gender;

  @ApiPropertyOptional({ enum: ['ru', 'uz'] })
  @IsOptional()
  @IsIn(['ru', 'uz'])
  preferredLanguage?: 'ru' | 'uz';
}
