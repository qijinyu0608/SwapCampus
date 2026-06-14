import { IsIn, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class ResolveOrderAppealDto {
  @IsString()
  @IsIn(['RESOLVED', 'REJECTED', 'CANCELED_ORDER', 'BAN_RESPONDENT', 'UNBAN_RESPONDENT'])
  nextStatus!: 'RESOLVED' | 'REJECTED' | 'CANCELED_ORDER' | 'BAN_RESPONDENT' | 'UNBAN_RESPONDENT';

  @IsString()
  @IsOptional()
  @IsNotEmpty()
  @MaxLength(500)
  resolutionNote?: string;
}
