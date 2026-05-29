import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length } from 'class-validator';

export class ApplyPromoCodeDto {
  @ApiProperty({ example: 'WELCOME10' })
  @IsString()
  @Length(3, 40)
  code!: string;
}
