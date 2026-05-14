import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { Queue } from 'bullmq';
import { AppEvents } from '../events/events.enum';
import { AUDIT_QUEUE } from './audit.constants';
import { ClsService } from 'nestjs-cls';
import { MyClsStore } from '../common/interface/cls-store.interface';

@Injectable()
export class AuditQueueListener {
  constructor(
    @InjectQueue(AUDIT_QUEUE) private auditQueue: Queue,
    private readonly cls: ClsService<MyClsStore>,
  ) {}

  private getMeta() {
    return {
      ip: this.cls.get('ip') ?? 'unknown',
      userId: this.cls.get('userId') ?? 'anonymous',
      correlationId: this.cls.get('correlationId') ?? 'unknown',
    };
  }

  @OnEvent(Object.values(AppEvents))
  async handleAppEvents(payload: {
    action: AppEvents;
    [key: string]: unknown;
  }) {
    const { action, ...data } = payload;

    await this.auditQueue.add(action, { ...this.getMeta(), ...data });
  }
}
