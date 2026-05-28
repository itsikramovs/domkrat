import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, Length } from 'class-validator';

export class MultiLangTextDto {
  @ApiProperty({ example: 'Тормозные колодки' })
  @IsString()
  @Length(1, 500)
  ru!: string;

  @ApiProperty({ example: 'Tormoz kolodkalari' })
  @IsString()
  @Length(1, 500)
  uz!: string;
}

export class OptionalMultiLangTextDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  ru?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  uz?: string;
}
