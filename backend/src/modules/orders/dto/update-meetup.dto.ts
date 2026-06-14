import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateMeetupDto {
  @IsString()
  @IsOptional()
  @IsNotEmpty()
  @MaxLength(120)
  meetupLocation?: string;

  @IsString()
  @IsOptional()
  @IsNotEmpty()
  @MaxLength(500)
  note?: string;
}
