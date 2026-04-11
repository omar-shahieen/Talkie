import { Injectable, LoggerService as NestLoggerService } from '@nestjs/common';
import winston from 'winston';
import 'winston-daily-rotate-file';

type LogLevel = 'error' | 'warn' | 'info' | 'http' | 'debug';

@Injectable()
export class LoggerService implements NestLoggerService {
  private readonly logger: winston.Logger;

  constructor() {
    const isDevelopment = process.env.NODE_ENV !== 'production';

    winston.addColors({
      error: 'red',
      warn: 'yellow',
      info: 'green',
      http: 'magenta',
      debug: 'white',
    });

    this.logger = winston.createLogger({
      level: isDevelopment ? 'debug' : 'info',
      levels: winston.config.npm.levels,
      format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.errors({ stack: true }),
        winston.format.splat(),
        winston.format.json(),
      ),
      transports: [
        this.buildConsoleTransport(),
        this.buildFileTransport('error', 'error'),
        this.buildFileTransport('combined', 'info'),
      ],
      exceptionHandlers: [this.buildFileTransport('exceptions', 'error')],
      rejectionHandlers: [this.buildFileTransport('rejections', 'error')],
      exitOnError: false,
    });
  }

  private buildConsoleTransport() {
    return new winston.transports.Console({
      format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
        winston.format.colorize({ all: true }),
        winston.format.printf(
          (info) =>
            // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
            `[${info.timestamp}] | ${info.level.toUpperCase()}: ${info.stack ?? info.message}`,
        ),
      ),
    });
  }

  private buildFileTransport(filename: string, level: LogLevel) {
    return new winston.transports.DailyRotateFile({
      filename: `logs/${filename}-%DATE%.log`,
      level,
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true,
      maxSize: '20m',
      maxFiles: '14d',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json(),
      ),
    });
  }

  // NestJS LoggerService interface methods
  log(message: string, context?: string) {
    this.logger.info(message, { context });
  }
  error(message: string, trace?: string, context?: string) {
    this.logger.error(message, { trace, context });
  }
  warn(message: string, context?: string) {
    this.logger.warn(message, { context });
  }
  debug(message: string, context?: string) {
    this.logger.debug(message, { context });
  }
  verbose(message: string, context?: string) {
    this.logger.http(message, { context });
  }

  // Extended helpers
  logError(message: string, error?: unknown, meta?: Record<string, unknown>) {
    const serialized =
      error instanceof Error
        ? { message: error.message, stack: error.stack, name: error.name }
        : { raw: error };
    this.logger.error(message, { error: serialized, ...meta });
  }

  httpStream() {
    return { write: (message: string) => this.logger.http(message.trim()) };
  }

  child(defaultMeta: Record<string, unknown>): winston.Logger {
    return this.logger.child(defaultMeta);
  }
}
