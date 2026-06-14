import { IsEmail, IsInt, IsNotEmpty, IsOptional, IsString, Matches, Max, Min, MinLength } from 'class-validator';

export class RegisterDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{9}$/, { message: '学号必须为 9 位数字' })
  studentId!: string;

  @IsString()
  @IsNotEmpty()
  displayName!: string;

  @IsEmail()
  @Matches(/@bjfu\.edu\.cn$/i, { message: '请使用 @bjfu.edu.cn 邮箱注册' })
  email!: string;

  @IsString()
  @IsOptional()
  college?: string;

  @IsInt({ message: '毕业年份必须为数字' })
  @Min(2000, { message: '毕业年份不正确' })
  @Max(2100, { message: '毕业年份不正确' })
  graduationYear!: number;

  @IsString()
  @IsOptional()
  avatarUrl?: string;

  @IsString()
  @IsNotEmpty()
  verificationCode!: string;

  @IsString()
  @MinLength(6)
  password!: string;
}
