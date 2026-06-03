import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export class RegisterDto {
  @IsString()
  @IsOptional()
  studentId?: string;

  @IsString()
  name!: string;

  @IsEmail()
  email!: string;

  @IsString()
  @IsOptional()
  college?: string;

  @IsString()
  @MinLength(6)
  password!: string;
}
