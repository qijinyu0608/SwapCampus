import { IsIn, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class ResolveReportDto {
  @IsString()
  @IsIn(['RESOLVED', 'REJECTED', 'OFFLINE_PRODUCT', 'BAN_USER', 'UNBAN_USER'])
  nextStatus!: 'RESOLVED' | 'REJECTED' | 'OFFLINE_PRODUCT' | 'BAN_USER' | 'UNBAN_USER';

  @IsString()
  @IsOptional()
  @IsNotEmpty()
  @MaxLength(500)
  resolutionNote?: string;
}
