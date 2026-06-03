import { CampusServiceStatus } from '@prisma/client';

export class UpdateAdminCampusServiceStatusDto {
  status!: CampusServiceStatus;
  handledBy?: number;
  reason?: string;
}
