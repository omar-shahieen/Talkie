import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { LoggingService } from './logging/logging.service';
import morgan from 'morgan';
async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  // replace winston logger with NestJS LoggerService
  const logger = app.get(LoggingService);
  app.useLogger(logger);

  app.use(
    morgan(':method :url :status :res[content-length] - :response-time ms', {
      stream: logger.httpStream(),
    }),
  );
  await app.listen(process.env.PORT ?? 3000);

  logger.log(
    `Application is running on: ${await app.getUrl()}`,
    'NestApplication',
  );
}
bootstrap();
