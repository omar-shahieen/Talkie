import { Module } from '@nestjs/common';

import { AuditService } from './audit.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditLog } from './auditLog.entity';
import { BullModule } from '@nestjs/bullmq';
import { AuditWorker } from './auditLogger.worker';
import { AuditQueueListener } from './auditQueuelistener';

export const AUDIT_QUEUE: string = 'audit-events';

@Module({
  imports: [
    TypeOrmModule.forFeature([AuditLog]),
    BullModule.registerQueue({
      name: AUDIT_QUEUE,
    }),
  ],
  providers: [AuditService, AuditQueueListener, AuditWorker],
})
export class AuditModule {}
