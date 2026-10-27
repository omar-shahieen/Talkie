import { Module } from '@nestjs/common';
import { MailerModule } from '@nestjs-modules/mailer';
import { MailService } from './mail.service';
import { existsSync } from 'fs';
import { join } from 'path';
import { HandlebarsAdapter } from '@nestjs-modules/mailer/adapters/handlebars.adapter';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MailQueueListener } from './mail.listner';
import { BullModule } from '@nestjs/bullmq';

@Module({
  imports: [
    ConfigModule,
    MailerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const templatesDir = existsSync(join(process.cwd(), 'templates'))
          ? join(process.cwd(), 'templates')
          : join(process.cwd(), 'apps', 'api', 'templates');

        return {
          // Conditional Transport Logic
          transport: {
            // Production: SendGrid
            host: config.get<string>('MAIL_HOST'),
            port: config.get<number>('MAIL_PORT'),
            auth: {
              user: config.get<string>('MAIL_USER'),
              pass: config.get<string>('MAIL_PASS'),
            },
          },
          defaults: {
            from: config.get<string>('MAIL_FROM'),
          },
          template: {
            dir: templatesDir,
            adapter: new HandlebarsAdapter(),
            options: {
              strict: true,
            },
          },
        };
      },
    }),

    // task queue
    BullModule.registerQueue({
      name: 'mailQueue',
    }),
  ],
  providers: [MailService, MailQueueListener],
  exports: [MailService],
})
export class MailModule {}
