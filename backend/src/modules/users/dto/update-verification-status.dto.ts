import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateVerificationStatusDto {
  @IsString()
  @IsIn(['APPROVED', 'REJECTED'])
  status!: 'APPROVED' | 'REJECTED';

  @IsString()
  @IsOptional()
  @MaxLength(200)
  reason?: string;
}
