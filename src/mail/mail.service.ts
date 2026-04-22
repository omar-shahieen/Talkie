import { Injectable } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';
import { IMailPayload } from './interfaces/mail.interface';
import { LoggingService } from '../logging/logging.service';

@Injectable()
export class MailService {
  constructor(
    private readonly mailerService: MailerService,
    private readonly logger: LoggingService,
  ) {
    this.logger.child({ context: MailService.name });
  }
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

  async handleUserSignupEvent(payload: { email: string; username?: string }) {
    await this.sendEmail({
      to: payload.email,
      subject: 'Welcome to our App!',
      template: 'welcome-email', // points to /mail/templates/welcome-email.hbs
      context: {
        name: payload.username ?? 'there',
      },
    });
  }

  async handleUserTfaEnabledEvent(payload: { email: string }) {
    await this.sendEmail({
      to: payload.email,
      subject: 'Two-factor authentication enabled',
      template: 'tfa-enabled',
      context: {
        email: payload.email,
      },
    });
  }

  async handleUserTfaDisabledEvent(payload: { email: string }) {
    await this.sendEmail({
      to: payload.email,
      subject: 'Two-factor authentication disabled',
      template: 'tfa-disabled',
      context: {
        email: payload.email,
      },
    });
  }
}
