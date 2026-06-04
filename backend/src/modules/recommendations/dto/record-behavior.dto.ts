import { BehaviorEventType } from '@prisma/client';

export class RecordBehaviorDto {
  userId!: number;
  productId!: number;
  eventType!: BehaviorEventType;
}
