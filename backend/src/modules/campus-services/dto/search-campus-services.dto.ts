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
  CampusServiceIntent,
  CampusServiceListingStatus
} from '@prisma/client';

const CAMPUS_SERVICE_SORT_OPTIONS = ['composite', 'price_asc', 'price_desc', 'newest'] as const;
const CAMPUS_SERVICE_CREDIT_OPTIONS = ['OUTSTANDING', 'EXCELLENT', 'GOOD', 'STABLE', 'IMPROVE'] as const;

export type CampusServiceSortOption = (typeof CAMPUS_SERVICE_SORT_OPTIONS)[number];
export type CampusServiceCreditOption = (typeof CAMPUS_SERVICE_CREDIT_OPTIONS)[number];

function toNumber(value: unknown) {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  const next = Number(value);
  return Number.isFinite(next) ? next : value;
}

function toStringArray(value: unknown) {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  const values = Array.isArray(value) ? value : [value];
  const normalized = values
    .flatMap((item) => String(item).split(','))
    .map((item) => item.trim())
    .filter(Boolean);

  return normalized.length ? normalized : undefined;
}

export class SearchCampusServicesDto {
  @IsOptional()
  @Transform(({ value }) => toNumber(value))
  @IsInt()
  @Min(1)
  ownerId?: number;

  @IsOptional()
  @IsEnum(CampusServiceIntent)
  intent?: CampusServiceIntent;

  @IsOptional()
  @IsEnum(CampusServiceCategory)
  category?: CampusServiceCategory;

  @IsOptional()
  @IsEnum(CampusServiceListingStatus)
  status?: CampusServiceListingStatus;

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
  @Transform(({ value }) => toStringArray(value))
  @IsIn(CAMPUS_SERVICE_CREDIT_OPTIONS, { each: true })
  credit?: CampusServiceCreditOption[];

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

export const OUTSTANDING_CREDIT_SCORE = 90;
export const EXCELLENT_CREDIT_SCORE = 80;
export const GOOD_CREDIT_SCORE = 70;
export const STABLE_CREDIT_SCORE = 60;
