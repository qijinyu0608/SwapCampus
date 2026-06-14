import { IsArray, IsBoolean, IsEnum, IsInt, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import {
  CampusServiceCategory,
  CampusServiceContactPreference,
  CampusServiceFulfillmentMode,
  CampusServiceLocationMode,
  CampusServicePattern,
  CampusServicePriceMode,
  CampusServiceUrgency
} from '@prisma/client';

export class UpdateCampusServiceDto {
  @IsString()
  @IsOptional()
  title?: string;

  @IsEnum(CampusServiceCategory)
  @IsOptional()
  category?: CampusServiceCategory;

  @IsString()
  @IsOptional()
  description?: string;

  @IsEnum(CampusServicePattern)
  @IsOptional()
  pattern?: CampusServicePattern;

  @IsEnum(CampusServicePriceMode)
  @IsOptional()
  priceMode?: CampusServicePriceMode;

  @IsNumber()
  @Min(0.01)
  @IsOptional()
  reward?: number;

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
  validFromAt?: string;

  @IsString()
  @IsOptional()
  validUntilAt?: string;

  @IsInt()
  @Min(5)
  @IsOptional()
  estimatedMinutes?: number;

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
  maxTotalOrders?: number | null;

  @IsInt()
  @Min(1)
  @IsOptional()
  maxConcurrentOrders?: number;

  @IsBoolean()
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
