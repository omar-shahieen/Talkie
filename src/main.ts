import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { LoggerService } from './logger/logger.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  // replace winston logger with NestJS LoggerService
  const logger = app.get(LoggerService);
  app.useLogger(logger);

  await app.listen(process.env.PORT ?? 3000);

  logger.log(
    `Application is running on: ${await app.getUrl()}`,
    'NestApplication',
  );
}
bootstrap();
