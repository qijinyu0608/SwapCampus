import { IsInt, IsOptional, IsString } from 'class-validator';

export class AcceptCampusServiceDto {
  @IsInt()
  userId!: number;

  @IsString()
  @IsOptional()
  initialMessage?: string;
}
