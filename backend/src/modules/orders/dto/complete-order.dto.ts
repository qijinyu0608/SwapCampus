import { IsInt } from 'class-validator';

export class CompleteOrderDto {
  @IsInt()
  userId!: number;
}
