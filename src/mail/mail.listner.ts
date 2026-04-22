import {
  OnQueueEvent,
  QueueEventsHost,
  QueueEventsListener,
} from '@nestjs/bullmq';
import { LoggingService } from 'src/logging/logging.service';

@QueueEventsListener('mail')
export class MailQueueEvents extends QueueEventsHost {
  constructor(private readonly logger: LoggingService) {
    super();
    this.logger.child({ context: MailQueueEvents.name });
  }
  @OnQueueEvent('active')
  onActive(args: { jobId: string; prev?: string }) {
    this.logger.log(`Queue Event [active]: Job ${args.jobId} is now active.`);
  }

  @OnQueueEvent('completed')
  onCompleted(args: { jobId: string; returnvalue: string; prev?: string }) {
    this.logger.log(
      `Queue Event [completed]: Job ${args.jobId} completed successfully.`,
    );
  }

  @OnQueueEvent('failed')
  onFailed(args: { jobId: string; failedReason: string; prev?: string }) {
    this.logger.error(
      `Queue Event [failed]: Job ${args.jobId} failed - ${args.failedReason}`,
    );
  }

  @OnQueueEvent('error')
  onError(args: Error) {
    this.logger.error(`Queue Event [error]: ${args.message}`, args.stack);
  }
}
