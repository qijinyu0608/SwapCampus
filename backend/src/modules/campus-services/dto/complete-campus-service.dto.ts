import { IsInt } from 'class-validator';

export class CompleteCampusServiceDto {
  @IsInt()
  userId!: number;
}
