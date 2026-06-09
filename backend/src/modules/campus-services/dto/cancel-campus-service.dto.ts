import { IsOptional, IsString } from 'class-validator';

export class CancelCampusServiceDto {
  @IsString()
  @IsOptional()
  reason?: string;
}
