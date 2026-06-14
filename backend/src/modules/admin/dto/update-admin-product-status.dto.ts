import { IsIn, IsInt, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateAdminProductStatusDto {
  @IsIn(['ON_SALE', 'OFFLINE'])
  status!: 'ON_SALE' | 'OFFLINE';

  @IsOptional()
  @IsInt()
  handledBy?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
