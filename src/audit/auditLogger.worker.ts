import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { AppEvents } from '../events/events.enum';
import { LoggingService } from '../logging/logging.service';
import { AuditService } from './audit.service';

@Processor('auditQueue')
export class AuditWorker extends WorkerHost {
  constructor(
    private readonly auditService: AuditService,
    private readonly logger: LoggingService,
  ) {
    super();
    this.logger.child({ context: AuditWorker.name });
  }

  async process(
    job: Job<Record<string, unknown>, void, AppEvents>,
  ): Promise<any> {
    await this.auditService.create(job.name, job.data); // name : appaction ,data : payload
  }

  @OnWorkerEvent('active')
  onActive(job: Job) {
    this.logger.log(
      `Processing job ${job.id} of type ${job.name} with data ${JSON.stringify(job.data)}...`,
    );
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job) {
    this.logger.log(`Completed job ${job.id} of type ${job.name}`);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job | undefined, error: Error) {
    this.logger.error(
      `Failed job ${job?.id} of type ${job?.name}: ${error.message}`,
      error.stack,
    );
  }
}
