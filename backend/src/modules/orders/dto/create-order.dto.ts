import { IsInt, IsOptional, IsString } from 'class-validator';

export class CreateOrderDto {
  @IsInt()
  productId!: number;

  @IsString()
  @IsOptional()
  meetupLocation?: string;

  @IsString()
  @IsOptional()
  meetupTime?: string;

  @IsString()
  @IsOptional()
  paymentIntent?: string;

  @IsString()
  @IsOptional()
  note?: string;
}
