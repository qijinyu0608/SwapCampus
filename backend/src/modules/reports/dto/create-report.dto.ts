import { IsInt, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateReportDto {
  @IsInt()
  @IsOptional()
  productId?: number;

  @IsInt()
  @IsOptional()
  campusServiceListingId?: number;

  @IsInt()
  @IsOptional()
  targetUserId?: number;

  @IsString()
  @IsNotEmpty()
  reason!: string;
}
