import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { ClsModule } from 'nestjs-cls';

import { redisOptionsFromUrl } from './common/config/redis-url';
import { LoggingModule } from './logging/logging.module';
import { MailModule } from './mail/mail.module';
import { MailWorker } from './mail/mail.worker';
import { AuditModule } from './audit/audit.module';
import { AuditWorker } from './audit/auditLogger.worker';
import { MessagesModule } from './messages/messages.module';
import { MessageRetentionConsumer } from './messages/message-retention.queue';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),

    ClsModule.forRoot({
      global: true,
      middleware: {
        mount: false,
      },
    }),

    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        url: config.getOrThrow<string>('DATABASE_URL'),
        autoLoadEntities: true,
        entities: [__dirname + '/**/entity/*{.js,.ts}'],
        subscribers: [__dirname + '/**/*.subscriber{.ts,.js}'],
        synchronize:
          (config.get<string>('DB_SYNC') ??
            (config.get<string>('NODE_ENV') === 'production'
              ? 'false'
              : 'true')) === 'true',
      }),
    }),

    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        connection: redisOptionsFromUrl(
          configService.getOrThrow<string>('REDIS_URL'),
        ),
        defaultJobOptions: {
          attempts: 3,
          backoff: {
            type: 'exponential',
          },
          removeOnComplete: 300,
          removeOnFail: 300,
        },
      }),
    }),

    LoggingModule,
    MailModule,
    AuditModule,
    MessagesModule,
  ],
  providers: [AuditWorker, MailWorker, MessageRetentionConsumer],
})
export class WorkerModule {}
