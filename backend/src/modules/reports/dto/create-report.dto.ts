import { IsInt, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

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
  @MaxLength(500)
  reason!: string;
}
