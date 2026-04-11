import { AuditService } from './audit.service';
import { LoggerService } from '@nestjs/common';
import { AppEvents } from '../events/events.enum';
import { OnEvent } from '@nestjs/event-emitter';

export class AuditLoggerListener {
  constructor(
    private readonly auditService: AuditService,
    private readonly logger: LoggerService,
  ) {}

  @OnEvent(Object.values(AppEvents))
  async handleAppEvent(event: AppEvents, payload: Record<string, unknown>) {
    try {
      const audit = await this.auditService.create(event, payload);
      this.logger.log(
        `[AuditLogger] Saved → event: ${event} (id: ${audit.id})`,
        AuditLoggerListener.name,
      );
    } catch (error) {
      this.logger.error(
        `[AuditLogger] Failed to save audit log for "${event}"`,
        error,
      );
    }
  }
}
