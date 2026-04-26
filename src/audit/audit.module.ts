import { Module, Global } from '@nestjs/common';

import { AuditService } from './audit.service';
import { AuditLoggerListener } from './audit-logger.listener';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditLog } from './audit-log.entity';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([AuditLog])],
  providers: [AuditService, AuditLoggerListener],
  exports: [AuditService],
})
export class AuditModule {}
