import { Injectable, LoggerService as NestLoggerService } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { MyClsStore } from '../common/interface/cls-store.interface';
import winston from 'winston';

type MetaArg = Record<string, any> | string | undefined;

@Injectable()
export class LoggingService implements NestLoggerService {
  private logger: winston.Logger;
  private readonly serviceName = process.env.npm_package_name ?? 'talkie';

  constructor(private readonly cls: ClsService<MyClsStore>) {
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
      defaultMeta: {
        service: this.serviceName,
      },
      format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.errors({ stack: true }),
        winston.format.splat(),
      ),
      transports: [this.buildConsoleTransport(isDevelopment)],
      exitOnError: false,
    });
  }

  private normalizeMeta(meta: MetaArg): Record<string, any> {
    if (typeof meta === 'string') {
      return { context: meta, service: this.serviceName };
    }

    return {
      service: this.serviceName,
      ...(meta ?? {}),
    };
  }

  private getMeta() {
    return {
      ip: this.cls.get('ip') ?? 'unknown',
      userId: this.cls.get('userId') ?? 'anonymous',
      correlationId: this.cls.get('correlationId') ?? 'unknown',
    };
  }

  // NestJS LoggerService interface
  log(message: string, meta?: MetaArg) {
    this.logger.info(message, {
      ...this.normalizeMeta(meta),
      ...this.getMeta(),
    });
  }
  error(message: string, meta?: MetaArg) {
    this.logger.error(message, {
      ...this.normalizeMeta(meta),
      ...this.getMeta(),
    });
  }
  warn(message: string, meta?: MetaArg) {
    this.logger.warn(message, {
      ...this.normalizeMeta(meta),
      ...this.getMeta(),
    });
  }
  debug(message: string, meta?: MetaArg) {
    this.logger.debug(message, {
      ...this.normalizeMeta(meta),
      ...this.getMeta(),
    });
  }
  // NestJS verbose() → winston http level
  verbose(message: string, meta?: MetaArg) {
    this.logger.http(message, {
      ...this.normalizeMeta(meta),
      ...this.getMeta(),
    });
  }

  // Extended helper for Error objects
  logError(message: string, error?: unknown, meta?: Record<string, unknown>) {
    const serialized =
      error instanceof Error
        ? { message: error.message, stack: error.stack, name: error.name }
        : { raw: error };

    this.logger.error(message, {
      error: serialized,
      ...meta,
      ...this.getMeta(),
    });
  }

  private formatLogValue(value: unknown): string {
    if (value === null || value === undefined) return '';
    if (typeof value === 'string') return value;
    if (typeof value === 'number' || typeof value === 'boolean') {
      return String(value);
    }

    try {
      return JSON.stringify(value);
    } catch {
      return '[unserializable]';
    }
  }

  private buildConsoleTransport(isDevelopment: boolean) {
    if (isDevelopment) {
      return new winston.transports.Console({
        handleExceptions: true,
        handleRejections: true,
        format: winston.format.combine(
          winston.format.colorize({ all: true }),
          winston.format.printf((info) => {
            const contextLabel = info.context
              ? `${this.formatLogValue(info.service ?? this.serviceName)}:${this.formatLogValue(info.context)}`
              : this.formatLogValue(info.service ?? this.serviceName);
            const timestamp = this.formatLogValue(info.timestamp);
            const level = this.formatLogValue(info.level).toUpperCase();
            const message = this.formatLogValue(info.stack ?? info.message);

            return `[${timestamp}] | ${contextLabel} | ${level}: ${message}`;
          }),
        ),
      });
    }

    return new winston.transports.Console({
      handleExceptions: true,
      handleRejections: true,
      format: winston.format.combine(winston.format.json()),
    });
  }
}
