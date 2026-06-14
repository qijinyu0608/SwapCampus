import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CancelOrderDto {
  @IsString()
  @IsOptional()
  @IsNotEmpty()
  @MaxLength(500)
  reason?: string;
}
