import { IsInt, IsOptional, IsString } from 'class-validator';

export class CreateConversationDto {
  @IsInt()
  productId!: number;

  @IsString()
  @IsOptional()
  initialMessage?: string;
}
