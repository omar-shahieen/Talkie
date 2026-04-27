import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { AppEvents } from '../events/events.enum';
import { MailService } from './mail.service';
import { LoggingService } from '../logging/logging.service';

export interface MailJobData {
  email: string;
  username?: string;
  reseturlLink?: string;
}

@Processor('mailQueue')
export class MailWorker extends WorkerHost {
  constructor(
    private readonly mailService: MailService,
    private readonly logger: LoggingService,
  ) {
    super();
    this.logger.child({ context: MailWorker.name });
  }

  async process(job: Job<MailJobData, void, AppEvents>): Promise<any> {
    switch (job.name) {
      case AppEvents.USER_SIGNUP: {
        await this.mailService.sendUserSignup({
          email: job.data.email,
          username: job.data.username,
        });
        break;
      }
      case AppEvents.USER_TFA_ENABLED: {
        await this.mailService.sendUserTfaEnabled({
          email: job.data.email,
        });
        break;
      }
      case AppEvents.USER_TFA_DISABLED: {
        await this.mailService.sendUserTfaDisabled({
          email: job.data.email,
        });
        break;
      }
      case AppEvents.USER_FORGETPASSWORD: {
        await this.mailService.sendResetPasswordLink({
          email: job.data.email,
          reseturlLink: job.data.reseturlLink as string,
          username: job.data.username as string,
        });
        break;
      }
      default: {
        throw new Error(`Unknown Event mail: ${job.name}`);
      }
    }
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
