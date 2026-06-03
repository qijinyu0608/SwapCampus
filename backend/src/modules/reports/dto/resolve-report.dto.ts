export class ResolveReportDto {
  handledBy!: number;
  resolutionNote!: string;
  nextStatus!: 'RESOLVED' | 'REJECTED' | 'OFFLINE_PRODUCT' | 'BAN_USER' | 'UNBAN_USER';
}
