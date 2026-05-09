import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { AppEvents } from '../events/events.enum';
import { LoggingService } from '../logging/logging.service';
import { AuditService } from './audit.service';
import { AUDIT_QUEUE } from './audit.constants';

@Processor(AUDIT_QUEUE)
export class AuditWorker extends WorkerHost {
  constructor(
    private readonly auditService: AuditService,
    private readonly logger: LoggingService,
  ) {
    super();
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
      {
        context: AuditWorker.name,
        action: 'active',
        jobId: job.id,
        jobName: job.name,
      },
    );
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job) {
    this.logger.log(`Completed job ${job.id} of type ${job.name}`, {
      context: AuditWorker.name,
      action: 'completed',
      jobId: job.id,
      jobName: job.name,
    });
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job | undefined, error: Error) {
    this.logger.error(
      `Failed job ${job?.id} of type ${job?.name}: ${error.message}`,
      {
        context: AuditWorker.name,
        action: 'failed',
        jobId: job?.id,
        jobName: job?.name,
        error: error.message,
        stack: error.stack,
      },
    );
  }
}
