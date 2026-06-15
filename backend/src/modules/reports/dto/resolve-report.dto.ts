import { IsIn, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import type { GovernancePenaltyLevel } from '../../moderation/governance-penalty.utils';

export class ResolveReportDto {
  @IsString()
  @IsIn(['RESOLVED', 'REJECTED', 'OFFLINE_PRODUCT', 'BAN_USER', 'UNBAN_USER'])
  nextStatus!: 'RESOLVED' | 'REJECTED' | 'OFFLINE_PRODUCT' | 'BAN_USER' | 'UNBAN_USER';

  @IsString()
  @IsOptional()
  @IsIn(['NORMAL', 'SEVERE'])
  penaltyLevel?: GovernancePenaltyLevel;

  @IsString()
  @IsOptional()
  @IsNotEmpty()
  @MaxLength(500)
  resolutionNote?: string;
}
