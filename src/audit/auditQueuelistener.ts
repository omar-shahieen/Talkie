import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { Queue } from 'bullmq';
import { AppEvents } from 'src/events/events.enum';
import { AUDIT_QUEUE } from './audit.module';

@Injectable()
export class AuditQueueListener {
  constructor(@InjectQueue(AUDIT_QUEUE) private auditQueue: Queue) {}

  @OnEvent(Object.values(AppEvents))
  async handleAppEvents(payload: {
    action: AppEvents;
    [key: string]: unknown;
  }) {
    const { action, ...data } = payload;
    await this.auditQueue.add(action, data);
  }
}
