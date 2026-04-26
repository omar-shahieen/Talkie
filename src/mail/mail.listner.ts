import {
  InjectQueue,
  OnQueueEvent,
  QueueEventsHost,
  QueueEventsListener,
} from '@nestjs/bullmq';
import { OnEvent } from '@nestjs/event-emitter';
import { Queue } from 'bullmq';
import { AppEvents } from 'src/events/events.enum';
import { LoggingService } from 'src/logging/logging.service';

@QueueEventsListener('mail')
export class MailQueueListener extends QueueEventsHost {
  constructor(
    private readonly logger: LoggingService,
    @InjectQueue('mailQueue') private mailQueue: Queue,
  ) {
    super();
    this.logger.child({ context: MailQueueListener.name });
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

  @OnEvent(AppEvents.USER_TFA_ENABLED)
  async handleTfaEnabledEvent(payload: { email: string }) {
    await this.mailQueue.add(AppEvents.USER_TFA_ENABLED, {
      email: payload.email,
    });
  }
  @OnEvent(AppEvents.USER_TFA_DISABLED)
  async handleTfaDisabledEvent(payload: { email: string }) {
    await this.mailQueue.add(AppEvents.USER_TFA_DISABLED, {
      email: payload.email,
    });
  }
  @OnEvent(AppEvents.USER_SIGNUP)
  async handleTfaSignEvent(payload: { email: string; username: string }) {
    await this.mailQueue.add(AppEvents.USER_SIGNUP, {
      email: payload.email,
      username: payload.username,
    });
  }

  @OnEvent(AppEvents.USER_SIGNUP)
  async handleForgetPasswordEvent(payload: {
    email: string;
    username: string;
    reseturlLink: string;
  }) {
    await this.mailQueue.add(AppEvents.USER_SIGNUP, {
      email: payload.email,
      username: payload.username,
      reseturlLink: payload.reseturlLink,
    });
  }
}
