import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { LoggerService } from './logger/logger.service';
import { AuditModule } from './audit/audit.module';
import { MongooseModule } from '@nestjs/mongoose';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { EventBusService } from './events/event-bus.service';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { AccessControlModule } from './access-control/access-control.module';

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
    AuditModule,
    UsersModule,
    AuthModule,
    AccessControlModule,
  ],
  controllers: [AppController],
  providers: [AppService, LoggerService, EventBusService],
})
export class AppModule {}
