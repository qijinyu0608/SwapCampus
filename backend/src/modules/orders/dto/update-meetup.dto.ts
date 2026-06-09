import { IsOptional, IsString } from 'class-validator';

export class UpdateMeetupDto {
  @IsString()
  @IsOptional()
  meetupLocation?: string;

  @IsString()
  @IsOptional()
  note?: string;
}
