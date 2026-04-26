import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { Queue } from 'bullmq';
import { AppEvents } from 'src/events/events.enum';

@Injectable()
export class AuditQueueListener {
  constructor(@InjectQueue('auditQueue') private auditQueue: Queue) {}

  @OnEvent(Object.values(AppEvents))
  async handleAppEvents(payload: {
    action: AppEvents;
    [key: string]: unknown;
  }) {
    const { action, ...data } = payload;
    await this.auditQueue.add(action, data);
  }
}
