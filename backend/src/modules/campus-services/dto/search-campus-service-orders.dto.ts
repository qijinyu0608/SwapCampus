import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  Max,
  Min
} from 'class-validator';
import {
  CampusServiceIntent,
  CampusServiceOrderStatus
} from '@prisma/client';

const CAMPUS_SERVICE_ORDER_ROLE_OPTIONS = ['REQUESTER', 'PROVIDER'] as const;
const CAMPUS_SERVICE_ORDER_GROUP_OPTIONS = ['PENDING', 'ACTIVE', 'WAITING_COMPLETE', 'ENDED'] as const;

export type CampusServiceOrderRole = (typeof CAMPUS_SERVICE_ORDER_ROLE_OPTIONS)[number];
export type CampusServiceOrderGroup = (typeof CAMPUS_SERVICE_ORDER_GROUP_OPTIONS)[number];

function toNumber(value: unknown) {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  const next = Number(value);
  return Number.isFinite(next) ? next : value;
}

export class SearchCampusServiceOrdersDto {
  @IsOptional()
  @Transform(({ value }) => toNumber(value))
  @IsInt()
  @Min(1)
  listingId?: number;

  @IsOptional()
  @IsEnum(CAMPUS_SERVICE_ORDER_ROLE_OPTIONS)
  role?: CampusServiceOrderRole;

  @IsOptional()
  @IsEnum(CampusServiceIntent)
  intent?: CampusServiceIntent;

  @IsOptional()
  @IsEnum(CampusServiceOrderStatus)
  status?: CampusServiceOrderStatus;

  @IsOptional()
  @IsEnum(CAMPUS_SERVICE_ORDER_GROUP_OPTIONS)
  group?: CampusServiceOrderGroup;

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
