import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuditModule } from './audit/audit.module';
import { MongooseModule } from '@nestjs/mongoose';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { EventBusService } from './events/event-bus.service';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { AccessControlModule } from './access-control/access-control.module';
import { LoggingModule } from './logging/logging.module';
import { CacheInterceptor, CacheModule } from '@nestjs/cache-manager';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { RolesModule } from './roles/roles.module';
import { ChannelsModule } from './channels/channels.module';
import { ServersModule } from './servers/servers.module';
import { MessagesModule } from './messages/messages.module';

@Module({
  imports: [
    MongooseModule.forRoot(
      // db for audit
      process.env.MONGO_URI ?? 'mongodb://localhost:27017/discord_demo',
    ),
    EventEmitterModule.forRoot({
      // event emitter
      wildcard: true, // enables 'user.*' subscriptions
      delimiter: '.', // dot notation for namespacing
      maxListeners: 20,
    }),
    CacheModule.register({
      // cache
      isGlobal: true,
      ttl: 5000, // in ms
    }),
    ConfigModule.forRoot({ isGlobal: true }), // .env

    TypeOrmModule.forRootAsync({
      // postgress
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get<string>('DB_HOST'),
        port: config.get<number>('DB_PORT'),
        username: config.get<string>('DB_USERNAME'),
        password: config.get<string>('DB_PASSWORD'),
        database: config.get<string>('DB_NAME'),

        autoLoadEntities: true,
        entities: [__dirname + '/**/entity/*{.js,.ts}'],

        synchronize: config.get<string>('DB_SYNC') === 'true',

        logging: true,
      }),
    }),
    // GLOBAL MODULES
    AuthModule,
    AccessControlModule,
    AuditModule,
    LoggingModule,

    // APP_MODULES
    UsersModule,
    RolesModule,
    ChannelsModule,
    ServersModule,
    MessagesModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    EventBusService,
    {
      provide: APP_INTERCEPTOR,
      useClass: CacheInterceptor,
    },
  ],
})
export class AppModule {}
