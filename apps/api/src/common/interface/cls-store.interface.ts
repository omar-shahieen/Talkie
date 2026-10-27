import { ClsStore } from 'nestjs-cls';

export interface MyClsStore extends ClsStore {
  correlationId: string;
  userId?: string;
  ip: string;
}
