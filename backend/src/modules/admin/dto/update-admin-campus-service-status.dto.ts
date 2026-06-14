import { IsEnum, IsInt, IsOptional, IsString, MaxLength } from 'class-validator';

export enum AdminCampusServiceAction {
  CANCEL = 'CANCEL'
}

export class UpdateAdminCampusServiceStatusDto {
  @IsEnum(AdminCampusServiceAction)
  action!: AdminCampusServiceAction;

  @IsOptional()
  @IsInt()
  handledBy?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
