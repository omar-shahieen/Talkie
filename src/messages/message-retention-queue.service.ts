import { Queue } from 'bullmq';
import { HARD_DELETE_DELAY_MS, MESSAGE_QUEUE } from './message.constant';
import { LoggingService } from 'src/logging/logging.service';
import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';

@Injectable()
export class MessageRetentionQueueService {
  constructor(
    @InjectQueue(MESSAGE_QUEUE)
    private readonly queue: Queue,
    private readonly logger: LoggingService,
  ) {}

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
      {
        context: MessageRetentionQueueService.name,
        action: 'enqueueHardDelete',
        messageId,
        delayMs: HARD_DELETE_DELAY_MS,
      },
    );
  }
}
