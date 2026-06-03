export class CreateReportDto {
  reporterId!: number;
  productId?: number;
  targetUserId?: number;
  reason!: string;
}
