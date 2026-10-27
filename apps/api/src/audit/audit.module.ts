import { Module } from '@nestjs/common';

import { AuditService } from './audit.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditLog } from './auditLog.entity';
import { BullModule } from '@nestjs/bullmq';
import { AuditQueueListener } from './auditQueuelistener';
import { AUDIT_QUEUE } from './audit.constants';

@Module({
  imports: [
    TypeOrmModule.forFeature([AuditLog]),
    BullModule.registerQueue({
      name: AUDIT_QUEUE,
    }),
  ],
  providers: [AuditService, AuditQueueListener],
  exports: [AuditService],
})
export class AuditModule {}
