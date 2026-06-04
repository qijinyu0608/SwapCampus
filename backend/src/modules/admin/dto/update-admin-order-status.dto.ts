import { OrderStatus } from '@prisma/client';

export class UpdateAdminOrderStatusDto {
  status!: OrderStatus;
  handledBy?: number;
  reason?: string;
}
