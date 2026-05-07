import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { LoggingService } from '../logging/logging.service';
import { MessagesService } from './messages.service';
import {
  HardDeleteMessageJobData,
  MessageRetentionJobName,
} from './dtos/hard-delete-message-job.dto';
import { MESSAGE_QUEUE } from './message.constant';

@Processor(MESSAGE_QUEUE)
export class MessageRetentionConsumer extends WorkerHost {
  constructor(
    private readonly messagesService: MessagesService,
    private readonly logger: LoggingService,
  ) {
    super();
    this.logger.child({ context: MessageRetentionConsumer.name });
  }

  async process(
    job: Job<HardDeleteMessageJobData, void, MessageRetentionJobName>,
  ) {
    switch (job.name) {
      case 'hard-delete-message':
        await this.messagesService.hardDeleteSoftDeletedMessage(
          job.data.messageId,
        );
        return;
      default:
        throw new Error(`Unknown message retention job: ${job.name}`);
    }
  }
}
