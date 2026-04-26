import { AuditService } from './audit.service';
import { AppEvents } from '../events/events.enum';
import { OnEvent } from '@nestjs/event-emitter';
import { LoggingService } from '../logging/logging.service';

export class AuditLoggerListener {
  constructor(
    private readonly auditService: AuditService,
    private readonly logger: LoggingService,
  ) {
    this.logger.child({ context: AuditLoggerListener.name });
  }

  @OnEvent(Object.values(AppEvents))
  async handleAppEvent(event: AppEvents, payload: Record<string, unknown>) {
    try {
      const audit = await this.auditService.create(event, payload);
      this.logger.log(
        `[AuditLogger] Saved → event: ${event} (id: ${audit.id})`,
      );
    } catch (error) {
      this.logger.error(
        `[AuditLogger] Failed to save audit log for "${event}"`,
        error,
      );
    }
  }
}
