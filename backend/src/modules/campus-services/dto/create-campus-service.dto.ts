import { IsArray, IsEnum, IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import {
  CampusServiceCategory,
  CampusServiceContactPreference,
  CampusServiceFulfillmentMode,
  CampusServiceIntent,
  CampusServiceLocationMode,
  CampusServicePattern,
  CampusServicePriceMode,
  CampusServiceUrgency
} from '@prisma/client';

export class CreateCampusServiceDto {
  @IsEnum(CampusServiceIntent)
  @IsOptional()
  intent?: CampusServiceIntent;

  @IsEnum(CampusServicePattern)
  @IsOptional()
  pattern?: CampusServicePattern;

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
  @IsOptional()
  reward?: number;

  @IsEnum(CampusServicePriceMode)
  @IsOptional()
  priceMode?: CampusServicePriceMode;

  @IsNumber()
  @Min(0)
  @IsOptional()
  amount?: number;

  @IsString()
  @IsOptional()
  locationFrom?: string;

  @IsString()
  @IsOptional()
  locationTo?: string;

  @IsEnum(CampusServiceLocationMode)
  @IsOptional()
  locationMode?: CampusServiceLocationMode;

  @IsString()
  @IsOptional()
  locationNote?: string;

  @IsString()
  @IsOptional()
  deadlineLabel?: string;

  @IsString()
  @IsOptional()
  validFromAt?: string;

  @IsString()
  @IsOptional()
  validUntilAt?: string;

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

  @IsInt()
  @Min(1)
  @IsOptional()
  maxTotalOrders?: number;

  @IsInt()
  @Min(1)
  @IsOptional()
  maxConcurrentOrders?: number;

  @IsOptional()
  autoConfirm?: boolean;

  @IsString()
  @IsOptional()
  trustNote?: string;

  @IsArray()
  @IsOptional()
  @IsString({ each: true })
  imageUrls?: string[];
}
