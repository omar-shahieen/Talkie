import { NestFactory } from '@nestjs/core';
import { WorkerModule } from './worker.module';
import { LoggingService } from './logging/logging.service';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(WorkerModule, {
    bufferLogs: true,
  });

  const logger = app.get(LoggingService);
  app.useLogger(logger);

  // Enable NestJS shutdown hooks for providers implementing OnModuleDestroy / beforeApplicationShutdown.
  // BullMQ workers wait for in-flight jobs and TypeORM closes its pool in
  // onApplicationShutdown; useProcessExit guarantees a clean exit code 0.
  app.enableShutdownHooks(undefined, { useProcessExit: true });

  logger.log(
    'BullMQ Worker process started and listening for jobs...',
    'WorkerBootstrap',
  );

  // Catch unhandled async errors in worker processes
  process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled rejection in worker process', String(reason));
    process.exit(1);
  });

  process.on('uncaughtException', (err) => {
    logger.error('Uncaught exception in worker process', err.stack);
    process.exit(1);
  });
}

void bootstrap().catch((error) => {
  console.error('Fatal worker bootstrap failure:', error);
  process.exit(1);
});
