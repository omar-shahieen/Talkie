import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UserModule } from './user/user.module';
import { LoggerService } from './logger/logger.service';
import { AuditModule } from './audit/audit.module';
import { MongooseModule } from '@nestjs/mongoose';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { EventBusService } from './events/event-bus.service';

@Module({
  imports: [
    MongooseModule.forRoot(
      process.env.MONGO_URI ?? 'mongodb://localhost:27017/discord_demo',
    ),
    EventEmitterModule.forRoot({
      wildcard: true, // enables 'user.*' subscriptions
      delimiter: '.', // dot notation for namespacing
      maxListeners: 20,
    }),
    UserModule,
    AuditModule,
  ],
  controllers: [AppController],
  providers: [AppService, LoggerService, EventBusService],
})
export class AppModule {}
