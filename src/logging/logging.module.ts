import { Global, Module } from '@nestjs/common';
import { LoggingService } from './logging.service';
// import { APP_INTERCEPTOR } from '@nestjs/core';
import { LoggingInterceptor } from './logging.interceptor';
@Global()
@Module({
  providers: [
    LoggingService,
    LoggingInterceptor,
    // {
    //   provide: APP_INTERCEPTOR,
    //   useClass: LoggingInterceptor,
    // },
  ],
  exports: [LoggingService],
})
export class LoggingModule {}
