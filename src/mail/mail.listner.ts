import { InjectQueue } from '@nestjs/bullmq';
import { OnEvent } from '@nestjs/event-emitter';
import { Queue } from 'bullmq';
import { AppEvents } from '../events/events.enum';
import { LoggingService } from '../logging/logging.service';
import { Injectable } from '@nestjs/common';

@Injectable()
export class MailQueueListener {
  constructor(
    private readonly logger: LoggingService,
    @InjectQueue('mailQueue') private mailQueue: Queue,
  ) {
    this.logger.child({ context: MailQueueListener.name });
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
