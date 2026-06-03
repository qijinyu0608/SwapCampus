import { IsEnum, IsInt, IsNotEmpty, IsNumber, IsString, Min } from 'class-validator';
import { CampusServiceCategory } from '@prisma/client';

export class CreateCampusServiceDto {
  @IsInt()
  publisherId!: number;

  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsEnum(CampusServiceCategory)
  category!: CampusServiceCategory;

  @IsString()
  @IsNotEmpty()
  description!: string;

  @IsNumber()
  @Min(0.01)
  reward!: number;

  @IsString()
  @IsNotEmpty()
  locationFrom!: string;

  @IsString()
  @IsNotEmpty()
  locationTo!: string;

  @IsString()
  @IsNotEmpty()
  deadlineLabel!: string;

  @IsInt()
  @Min(5)
  estimatedMinutes!: number;
}
