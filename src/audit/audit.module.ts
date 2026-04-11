import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuditLog, AuditLogSchema } from './audit-log.schema';
import { AuditService } from './audit.service';
import { AuditLoggerListener } from './audit-logger.listener';
import { LoggerService } from '../logger/logger.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: AuditLog.name, schema: AuditLogSchema },
    ]),
  ],
  providers: [AuditService, AuditLoggerListener, LoggerService],
  exports: [AuditService],
})
export class AuditModule {}
