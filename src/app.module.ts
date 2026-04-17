import { MiddlewareConsumer, Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuditModule } from './audit/audit.module';
import { MongooseModule } from '@nestjs/mongoose';
<<<<<<< HEAD
=======
import { EventEmitterModule } from '@nestjs/event-emitter';
import { EventsModule } from './events/events.module';
>>>>>>> 94bb6182375aedd915386855484f9a84710886df
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { AccessControlModule } from './access-control/access-control.module';
import { LoggingModule } from './logging/logging.module';
import { CacheInterceptor, CacheModule } from '@nestjs/cache-manager';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { RolesModule } from './roles/roles.module';
import { ChannelsModule } from './channels/channels.module';
import { ServersModule } from './servers/servers.module';
import { RealtimeModule } from './realtime/realtime.module';
import { MessagesModule } from './messages/messages.module';
import { EventsModule } from './events/events.module';
import { MailModule } from './mail/mail.module';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { AsyncContext } from './common/context/async-context.service';
import { ContextMiddleware } from './common/middleware/context.middleware';

@Module({
  imports: [
    MongooseModule.forRoot(
      // db for audit
      process.env.MONGO_URI ?? 'mongodb://localhost:27017/discord_demo',
    ),
    CacheModule.register({
      // cache
      isGlobal: true,
      ttl: 5000, // in ms
    }),
    ConfigModule.forRoot({ isGlobal: true }),
    EventsModule,
      ConfigModule.forRoot({ isGlobal: true }),
      EventsModule,

    TypeOrmModule.forRootAsync({
      // postgress
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get<string>('DB_HOST') ?? 'localhost',
        port: Number(config.get<string>('DB_PORT') ?? 5432),
        username: config.get<string>('DB_USERNAME') ?? 'postgres',
        password: config.get<string>('DB_PASSWORD') ?? 'postgres',
        database: config.get<string>('DB_NAME') ?? 'DISCORD',

        autoLoadEntities: true,
        entities: [__dirname + '/**/entity/*{.js,.ts}'],
        subscribers: [__dirname + '/**/*.subscriber{.ts,.js}'],
        synchronize: (config.get<string>('DB_SYNC') ?? 'true') === 'true',

        // logging: true,
      }),
    }),

    // GLOBAL MODULES
    AuthModule,
    AccessControlModule,
    AuditModule,
    LoggingModule,
    EventsModule,
    MailModule,

    // APP_MODULES
    UsersModule,
    RolesModule,
    ChannelsModule,
    ServersModule,
    RealtimeModule,
    MessagesModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_INTERCEPTOR,
      useClass: CacheInterceptor,
    },
    { provide: APP_FILTER, useClass: GlobalExceptionFilter },
    { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor },
    AsyncContext,
  ],
})
export class AppModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(ContextMiddleware).forRoutes('*');
  }
}
