// src/common/email/sender.service.ts
// other imports
import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { MailerService } from '@nestjs-modules/mailer';
import { IMailPayload } from './interfaces/mail.interface';
import { LoggingService } from '../logging/logging.service';

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

  @OnEvent('user.signup')
  async handleUserSignupEvent(payload: { email: string; name: string }) {
    await this.mailerService.sendMail({
      to: payload.email,
      subject: 'Welcome to our App!',
      template: 'welcome-email', // points to /mail/templates/welcome-email.hbs
      context: {
        name: payload.name,
      },
    });
    this.logger.log(
      `User signup email queued for ${payload.email}`,
      MailService.name,
    );
  }
}
