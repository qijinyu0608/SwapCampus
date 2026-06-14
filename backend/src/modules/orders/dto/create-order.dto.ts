import { IsInt, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateOrderDto {
  @IsInt()
  productId!: number;

  @IsString()
  @IsOptional()
  @IsNotEmpty()
  @MaxLength(120)
  meetupLocation?: string;

  @IsString()
  @IsOptional()
  @IsNotEmpty()
  @MaxLength(80)
  meetupTime?: string;

  @IsString()
  @IsOptional()
  @IsNotEmpty()
  @MaxLength(80)
  paymentIntent?: string;

  @IsString()
  @IsOptional()
  @IsNotEmpty()
  @MaxLength(500)
  note?: string;
}
