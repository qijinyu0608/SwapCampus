import { ProductStatus } from '@prisma/client';

export class UpdateAdminProductStatusDto {
  status!: ProductStatus;
  handledBy?: number;
  reason?: string;
}
