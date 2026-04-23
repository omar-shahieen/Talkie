import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Job, Queue } from 'bullmq';
import { LoggingService } from '../logging/logging.service';
import { MessagesService } from './messages.service';

interface HardDeleteMessageJobData {
  messageId: string;
}

type MessageRetentionJobName = 'hard-delete-message';

const HARD_DELETE_DELAY_MS = 24 * 60 * 60 * 1000;

@Processor('message-retention')
export class MessageRetentionConsumer extends WorkerHost {
  constructor(
    private readonly messagesService: MessagesService,
    private readonly logger: LoggingService,
  ) {
    super();
    this.logger.child({ context: MessageRetentionConsumer.name });
  }

  async process(job: Job<HardDeleteMessageJobData, void, MessageRetentionJobName>) {
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

@Injectable()
export class MessageRetentionQueueService {
  constructor(
    @InjectQueue('message-retention')
    private readonly queue: Queue,
    private readonly logger: LoggingService,
  ) {
    this.logger.child({ context: MessageRetentionQueueService.name });
  }

  async enqueueHardDelete(messageId: string) {
    await this.queue.add(
      'hard-delete-message',
      { messageId },
      {
        jobId: `hard-delete-message:${messageId}`,
        delay: HARD_DELETE_DELAY_MS,
        removeOnComplete: true,
        removeOnFail: true,
      },
    );

    this.logger.log(
      `Queued hard-delete for message ${messageId} after 24 hours`,
      MessageRetentionQueueService.name,
    );
  }
}