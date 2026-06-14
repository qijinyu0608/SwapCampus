import { IsEnum, IsInt, IsOptional, IsString } from 'class-validator';

export enum AdminCampusServiceAction {
  REOPEN = 'REOPEN',
  FORCE_MATCH = 'FORCE_MATCH',
  FORCE_COMPLETE = 'FORCE_COMPLETE',
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
  reason?: string;
}
