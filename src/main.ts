import { NestFactory, Reflector } from '@nestjs/core';
import { AppModule } from './app.module';
import { LoggingService } from './logging/logging.service';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import { ClassSerializerInterceptor, ValidationPipe } from '@nestjs/common';
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

  // validation
  app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)));
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

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
bootstrap();
