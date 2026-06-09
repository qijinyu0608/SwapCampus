import { IsOptional, IsString } from 'class-validator';

export class AcceptCampusServiceDto {
  @IsString()
  @IsOptional()
  initialMessage?: string;
}
