import { IsBoolean, IsInt, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateBanStatusDto {
  @IsBoolean()
  banned!: boolean;

  @IsOptional()
  @IsInt()
  handledBy?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
