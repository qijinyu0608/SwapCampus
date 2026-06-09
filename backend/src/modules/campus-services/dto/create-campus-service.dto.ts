import { IsEnum, IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import {
  CampusServiceCategory,
  CampusServiceContactPreference,
  CampusServiceFulfillmentMode,
  CampusServiceUrgency
} from '@prisma/client';

export class CreateCampusServiceDto {
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

  @IsEnum(CampusServiceUrgency)
  @IsOptional()
  urgency?: CampusServiceUrgency;

  @IsEnum(CampusServiceFulfillmentMode)
  @IsOptional()
  fulfillmentMode?: CampusServiceFulfillmentMode;

  @IsEnum(CampusServiceContactPreference)
  @IsOptional()
  contactPreference?: CampusServiceContactPreference;

  @IsInt()
  @Min(1)
  @IsOptional()
  itemCount?: number;

  @IsString()
  @IsOptional()
  trustNote?: string;
}
