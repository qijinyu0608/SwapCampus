import { IsInt, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateOrderDto {
  @IsInt()
  productId!: number;

  @IsInt()
  buyerId!: number;

  @IsString()
  @IsOptional()
  meetupLocation?: string;

  @IsString()
  @IsOptional()
  note?: string;
}
