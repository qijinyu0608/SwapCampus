import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min
} from 'class-validator';
import {
  CampusServiceCategory,
  CampusServiceStatus,
  VerificationStatus
} from '@prisma/client';

const CAMPUS_SERVICE_SORT_OPTIONS = ['composite', 'price_asc', 'price_desc', 'newest'] as const;
const CAMPUS_SERVICE_CREDIT_OPTIONS = ['ALL', 'HIGH', 'VERIFIED'] as const;

export type CampusServiceSortOption = (typeof CAMPUS_SERVICE_SORT_OPTIONS)[number];
export type CampusServiceCreditOption = (typeof CAMPUS_SERVICE_CREDIT_OPTIONS)[number];

function toNumber(value: unknown) {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  const next = Number(value);
  return Number.isFinite(next) ? next : value;
}

export class SearchCampusServicesDto {
  @IsOptional()
  @IsEnum(CampusServiceCategory)
  category?: CampusServiceCategory;

  @IsOptional()
  @IsEnum(CampusServiceStatus)
  status?: CampusServiceStatus;

  @IsOptional()
  @IsString()
  keyword?: string;

  @IsOptional()
  @IsIn(CAMPUS_SERVICE_SORT_OPTIONS)
  sort?: CampusServiceSortOption;

  @IsOptional()
  @Transform(({ value }) => toNumber(value))
  @IsInt()
  @Min(0)
  minReward?: number;

  @IsOptional()
  @Transform(({ value }) => toNumber(value))
  @IsInt()
  @Min(0)
  maxReward?: number;

  @IsOptional()
  @IsIn(CAMPUS_SERVICE_CREDIT_OPTIONS)
  credit?: CampusServiceCreditOption;

  @IsOptional()
  @Transform(({ value }) => toNumber(value))
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Transform(({ value }) => toNumber(value))
  @IsInt()
  @Min(1)
  @Max(60)
  pageSize?: number;
}

export const HIGH_CREDIT_SCORE = 85;
export const VERIFIED_STATUS = VerificationStatus.APPROVED;
