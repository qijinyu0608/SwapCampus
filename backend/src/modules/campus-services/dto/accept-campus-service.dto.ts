import { IsOptional, IsString } from 'class-validator';

export class AcceptCampusServiceDto {
  @IsString()
  @IsOptional()
  initialMessage?: string;

  @IsString()
  @IsOptional()
  serviceLocation?: string;

  @IsString()
  @IsOptional()
  serviceTime?: string;

  @IsString()
  @IsOptional()
  paymentIntent?: string;
}
