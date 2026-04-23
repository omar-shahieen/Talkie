import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, OnModuleInit } from '@nestjs/common';
import { Job, Queue } from 'bullmq';
import { LoggingService } from '../logging/logging.service';
import { MessagesService } from './messages.service';

type MessageRetentionJobName = 'purge-old-messages';

@Processor('message-retention')
export class MessageRetentionConsumer extends WorkerHost {
  constructor(
    private readonly messagesService: MessagesService,
    private readonly logger: LoggingService,
  ) {
    super();
    this.logger.child({ context: MessageRetentionConsumer.name });
  }

  async process(job: Job<Record<string, never>, void, MessageRetentionJobName>) {
    switch (job.name) {
      case 'purge-old-messages':
        await this.messagesService.purgeMessagesOlderThanSevenDays();
        return;
      default:
        throw new Error(`Unknown message retention job: ${job.name}`);
    }
  }
}

@Injectable()
export class MessageRetentionQueueScheduler implements OnModuleInit {
  constructor(
    @InjectQueue('message-retention')
    private readonly queue: Queue,
    private readonly logger: LoggingService,
  ) {
    this.logger.child({ context: MessageRetentionQueueScheduler.name });
  }

  async onModuleInit() {
    await this.queue.add(
      'purge-old-messages',
      {},
      {
        jobId: 'purge-old-messages',
        repeat: {
          pattern: '0 0 * * *',
        },
        removeOnComplete: true,
        removeOnFail: true,
      },
    );

    this.logger.log(
      'Scheduled BullMQ job purge-old-messages to run daily at midnight',
      MessageRetentionQueueScheduler.name,
    );
  }
}