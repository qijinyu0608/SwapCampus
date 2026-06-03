import { IsInt, IsOptional, IsString } from 'class-validator';

export class UpdateMeetupDto {
  @IsInt()
  userId!: number;

  @IsString()
  @IsOptional()
  meetupLocation?: string;

  @IsString()
  @IsOptional()
  note?: string;
}
