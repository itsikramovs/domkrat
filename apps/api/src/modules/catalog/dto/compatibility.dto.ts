import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';

export class CreateCompatibilityDto {
  @ApiPropertyOptional({ description: 'car_modifications.id' })
  @IsOptional()
  @IsUUID()
  carModificationId?: string;

  @ApiPropertyOptional({ description: 'car_models.id' })
  @IsOptional()
  @IsUUID()
  carModelId?: string;

  @ApiPropertyOptional({ description: 'car_makes.id' })
  @IsOptional()
  @IsUUID()
  carMakeId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1900)
  @Max(2100)
  yearFrom?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1900)
  @Max(2100)
  yearTo?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
