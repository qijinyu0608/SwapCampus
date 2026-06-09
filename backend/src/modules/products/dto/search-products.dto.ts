import { Transform } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

const PRODUCT_SORT_OPTIONS = ['relevance', 'newest', 'price_asc', 'price_desc'] as const;
const PRODUCT_TRADE_OPTIONS = ['all', 'meetup', 'dorm_pickup', 'available_today'] as const;

export type ProductSortOption = (typeof PRODUCT_SORT_OPTIONS)[number];
export type ProductTradeOption = (typeof PRODUCT_TRADE_OPTIONS)[number];

function toNumber(value: unknown) {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  const next = Number(value);
  return Number.isFinite(next) ? next : value;
}

export class SearchProductsDto {
  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  condition?: string;

  @IsOptional()
  @Transform(({ value }) => toNumber(value))
  @IsInt()
  @Min(1)
  sellerId?: number;

  @IsOptional()
  @IsString()
  ids?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsIn(PRODUCT_TRADE_OPTIONS)
  trade?: ProductTradeOption;

  @IsOptional()
  @IsIn(PRODUCT_SORT_OPTIONS)
  sort?: ProductSortOption;

  @IsOptional()
  @Transform(({ value }) => toNumber(value))
  @IsInt()
  @Min(0)
  minPrice?: number;

  @IsOptional()
  @Transform(({ value }) => toNumber(value))
  @IsInt()
  @Min(0)
  maxPrice?: number;

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
