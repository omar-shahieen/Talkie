// src/common/email/sender.service.ts
// other imports
import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { MailerService } from '@nestjs-modules/mailer';
import { IMailPayload } from './interfaces/mail.interface';
import { LoggingService } from '../logging/logging.service';
import { AppEvents } from '../common/events/events.enum';

@Injectable()
export class MailService {
  constructor(
    private readonly mailerService: MailerService,
    private readonly logger: LoggingService,
  ) {}
  async sendEmail(payload: IMailPayload): Promise<boolean> {
    const { to, subject, template, context, attachments, from } = payload;

    try {
      await this.mailerService.sendMail({
        ...(from ? { from } : {}),
        to: Array.isArray(to) ? to.join(', ') : to, // Handle single or multiple recipients
        subject,
        template,
        context,
        attachments,
      });
      this.logger.log(
        `Email sent successfully to ${Array.isArray(to) ? to.join(', ') : to} with template '${template}'`,
        MailService.name,
      );
      return true;
    } catch (error: any) {
      this.logger.logError(
        `Failed to send email to ${Array.isArray(to) ? to.join(', ') : to} with template '${template}'`,
        error,
        { to, template },
      );
      return false;
    }
  }

  @OnEvent(AppEvents.USER_SIGNUP)
  async handleUserSignupEvent(payload: { email: string; username?: string }) {
    await this.mailerService.sendMail({
      to: payload.email,
      subject: 'Welcome to our App!',
      template: 'welcome-email', // points to /mail/templates/welcome-email.hbs
      context: {
        name: payload.username ?? 'there',
      },
    });
    this.logger.log(
      `User signup email queued for ${payload.email}`,
      MailService.name,
    );
  }

  @OnEvent(AppEvents.USER_TFA_ENABLED)
  async handleUserTfaEnabledEvent(payload: { email: string }) {
    await this.mailerService.sendMail({
      to: payload.email,
      subject: 'Two-factor authentication enabled',
      template: 'tfa-enabled',
      context: {
        email: payload.email,
      },
    });
    this.logger.log(
      `TFA enabled email queued for ${payload.email}`,
      MailService.name,
    );
  }

  @OnEvent(AppEvents.USER_TFA_DISABLED)
  async handleUserTfaDisabledEvent(payload: { email: string }) {
    await this.mailerService.sendMail({
      to: payload.email,
      subject: 'Two-factor authentication disabled',
      template: 'tfa-disabled',
      context: {
        email: payload.email,
      },
    });
    this.logger.log(
      `TFA disabled email queued for ${payload.email}`,
      MailService.name,
    );
  }
}
