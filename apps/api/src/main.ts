import { NestFactory, Reflector } from '@nestjs/core';
import { AppModule } from './app.module';
import { LoggingService } from './logging/logging.service';

import cookieParser from 'cookie-parser';
import { ClassSerializerInterceptor, ValidationPipe } from '@nestjs/common';
import { ValidationException } from './common/exceptions/domain.exception';
async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  app.enableCors({ origin: true, credentials: true });

  // replace winston logger with NestJS LoggerService
  const logger = app.get(LoggingService);
  app.useLogger(logger);

  // cookie parser
  app.use(cookieParser());

  // validation
  app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)));

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      disableErrorMessages: process.env.NODE_ENV !== 'development',
      transformOptions: {
        enableImplicitConversion: true,
      },
      exceptionFactory: (errors) => {
        const structured = errors.reduce<Record<string, string[]>>(
          (acc, err) => {
            acc[err.property] = Object.values(err.constraints ?? {});
            return acc;
          },
          {},
        );
        return new ValidationException(structured);
      },
    }),
  );

  // Graceful shutdown: on SIGTERM/SIGINT Nest runs onModuleDestroy ->
  // beforeApplicationShutdown -> closes HTTP/WS (draining in-flight requests)
  // -> onApplicationShutdown (BullMQ, TypeORM), then exits with code 0.
  app.enableShutdownHooks(undefined, { useProcessExit: true });

  // Allow a parent process to trigger the same shutdown path over IPC.
  process.on('message', (msg) => {
    if (msg === 'shutdown' || msg === 'graceful-shutdown') {
      process.emit('SIGTERM');
    }
  });

  // Catch unhandled async errors that escape the NestJS pipeline
  process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled rejection', String(reason));
    process.exit(1);
  });
  process.on('uncaughtException', (err) => {
    logger.error('Uncaught exception', err.stack);
    process.exit(1);
  });

  await app.listen(process.env.PORT ?? 3000);

  logger.log(
    `Application is running on: ${await app.getUrl()}`,
    'NestApplication',
  );
}
void bootstrap().catch((error) => {
  console.error(error);
  process.exit(1);
});
