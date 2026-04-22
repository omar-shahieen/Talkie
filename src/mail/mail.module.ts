import { Global, Module } from '@nestjs/common';
import { MailerModule } from '@nestjs-modules/mailer';
import { MailService } from './mail.service';
import { join } from 'path';
import { HandlebarsAdapter } from '@nestjs-modules/mailer/adapters/handlebars.adapter';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MailConsumer } from './mail.worker';
import { MailQueueEvents } from './mail.listner';

@Global()
@Module({
  imports: [
    ConfigModule,
    MailerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const isProduction = config.get('NODE_ENV') === 'production';

        return {
          // Conditional Transport Logic
          transport: isProduction
            ? {
                // Production: SendGrid
                host: config.get<string>('PROD_MAIL_HOST'),
                port: config.get<number>('PROD_MAIL_PORT'),
                auth: {
                  user: config.get<string>('PROD_MAIL_USER'),
                  pass: config.get<string>('PROD_MAIL_PASS'),
                },
              }
            : {
                // Development:  Mailtrap
                host: config.get<string>('DEV_MAIL_HOST'),
                port: config.get<number>('DEV_MAIL_PORT'),
                auth: {
                  user: config.get<string>('DEV_MAIL_USER'),
                  pass: config.get<string>('DEV_MAIL_PASS'),
                },
              },
          defaults: {
            from: config.get<string>('MAIL_FROM'),
          },
          template: {
            dir: join(process.cwd(), 'templates'),
            adapter: new HandlebarsAdapter(),
            options: {
              strict: true,
            },
          },
        };
      },
    }),
  ],
  providers: [MailService, MailConsumer, MailQueueEvents],
})
export class MailModule {}
