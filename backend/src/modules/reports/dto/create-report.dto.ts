import { IsInt, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateReportDto {
  @IsInt()
  reporterId!: number;

  @IsInt()
  @IsOptional()
  productId?: number;

  @IsInt()
  @IsOptional()
  targetUserId?: number;

  @IsString()
  @IsNotEmpty()
  reason!: string;
}
