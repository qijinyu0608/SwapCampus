import { IsOptional, IsString, MaxLength } from 'class-validator';

export class RedeemRewardDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  note?: string;
}

