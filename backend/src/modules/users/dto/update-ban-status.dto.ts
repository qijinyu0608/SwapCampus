export class UpdateBanStatusDto {
  banned!: boolean;
  handledBy?: number;
  reason?: string;
}
