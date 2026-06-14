import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateOrderAppealDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(40)
  issueType!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason!: string;

  @IsString()
  @IsOptional()
  @MaxLength(80)
  expectedAction?: string;
}
