import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { LoggingService } from './logging/logging.service';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  // replace winston logger with NestJS LoggerService
  const logger = app.get(LoggingService);
  app.useLogger(logger);
  // Morgan for request logging
  app.use(
    morgan(':method :url :status :res[content-length] - :response-time ms', {
      stream: logger.httpStream(),
    }),
  );
  // cookie parser
  app.use(cookieParser());
  await app.listen(process.env.PORT ?? 3000);

  logger.log(
    `Application is running on: ${await app.getUrl()}`,
    'NestApplication',
  );
}
bootstrap();
