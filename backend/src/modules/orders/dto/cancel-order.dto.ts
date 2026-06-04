import { IsInt, IsOptional, IsString } from 'class-validator';

export class CancelOrderDto {
  @IsInt()
  userId!: number;

  @IsString()
  @IsOptional()
  reason?: string;
}
