import { IsIn, IsInt, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateAdminOrderStatusDto {
  @IsIn(['CANCELED'])
  status!: 'CANCELED';

  @IsOptional()
  @IsInt()
  handledBy?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
