import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuditModule } from './audit/audit.module';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { AccessControlModule } from './access-control/access-control.module';
import { LoggingModule } from './logging/logging.module';
import { CacheModule } from '@nestjs/cache-manager';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { HttpCacheInterceptor } from './common/interceptors/cache.interceptor';
import { RolesModule } from './roles/roles.module';
import { ChannelsModule } from './channels/channels.module';
import { ServersModule } from './servers/servers.module';
import { MessagesModule } from './messages/messages.module';
import { EventsModule } from './events/events.module';
import { MailModule } from './mail/mail.module';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { NotificationsModule } from './notifications/notifications.module';
import { PresenceModule } from './presence/presence.module';
import { BullModule } from '@nestjs/bullmq';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { ThrottlerStorageRedisService } from '@nest-lab/throttler-storage-redis';
import { InvitationsModule } from './invitations/invitations.module';
import { FriendsModule } from './friends/friends.module';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClsModule } from 'nestjs-cls';
import { AuthJwtGuard } from './auth/guards/auth-jwt.guard';
import { ServerPermissionsGuard } from './access-control/server-permissions/serverPermissions.guard';
import { AppPermissionsGuard } from './access-control/app-permissions/appPermissions.guard';
import { CorrelationIdInterceptor } from './common/interceptors/correlation-id.interceptor';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { FilesModule } from './files/files.module';
import { PrometheusModule } from '@willsoto/nestjs-prometheus';
import { MetricsModule } from './common/metrics/metrics.module';
import { createKeyv } from '@keyv/redis';
import { redisOptionsFromUrl } from './common/config/redis-url';

function getDatabaseUrl(config: ConfigService): string {
  const dbUrl = config.get<string>('DATABASE_URL');
  if (dbUrl) return dbUrl;
  const host = config.get<string>('DB_HOST', 'localhost');
  const port = config.get<number>('DB_PORT', 5432);
  const user = config.get<string>('DB_USERNAME', 'postgres');
  const pass = config.get<string>('DB_PASSWORD', 'postgres');
  const name = config.get<string>('DB_NAME', 'talkie');
  return `postgres://${encodeURIComponent(user)}:${encodeURIComponent(pass)}@${host}:${port}/${name}`;
}

function getRedisUrl(config: ConfigService): string {
  const redisUrl = config.getOrThrow<string>('REDIS_URL');
  if (redisUrl) return redisUrl;
  const host = config.get<string>('REDIS_HOST', 'localhost');
  const port = config.get<number>('REDIS_PORT', 6379);
  const pass = config.get<string>('REDIS_PASSWORD');
  const isTls = config.get<string>('REDIS_TLS') === 'true';
  const protocol = isTls ? 'rediss' : 'redis';
  const auth = pass ? `:${encodeURIComponent(pass)}@` : '';
  return `${protocol}://${auth}${host}:${port}`;
}

@Module({
  imports: [
    CacheModule.registerAsync({
      isGlobal: true,
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        stores: [createKeyv(getRedisUrl(config))],
        ttl: config.get<number>('CACHE_TTL', 5000), // in milliseconds
      }),
    }),

    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', 'apps/api/.env', '../apps/api/.env'],
    }),

    TypeOrmModule.forRootAsync({
      // postgress
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        url: getDatabaseUrl(config),
        autoLoadEntities: true,
        entities: [__dirname + '/**/entity/*{.js,.ts}'],
        subscribers: [__dirname + '/**/*.subscriber{.ts,.js}'],
        synchronize:
          (config.get<string>('DB_SYNC') ??
            (config.get<string>('NODE_ENV') === 'production'
              ? 'false'
              : 'true')) === 'true',

        // logging: true,
      }),
    }),

    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        connection: redisOptionsFromUrl(getRedisUrl(configService)),
        defaultJobOptions: {
          attempts: 3,
          backoff: {
            type: 'exponential',
          },
          removeOnComplete: 300,
          removeOnFail: 300,
        },
      }),
    }),

    // rate limiter

    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        throttlers: [
          {
            name: 'short',
            ttl: 1000, // 1 second window
            limit: 50, // stay under  50 req/s global limit for resource
          },
        ],
        storage: new ThrottlerStorageRedisService(getRedisUrl(config)),
      }),
    }),

    // Register the ClsModule,
    ClsModule.forRoot({
      global: true,
      middleware: {
        // automatically mount the
        // ClsMiddleware for all routes
        mount: true,
      },
    }),
    // register promotheous for metrics

    PrometheusModule.register({
      //GET /metrics
      defaultMetrics: { enabled: true }, // CPU, memory, event loop lag — free
      defaultLabels: {
        app: 'Talkie',
      },
    }),

    // GLOBAL MODULES
    AuthModule,
    EventsModule,
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
    MessagesModule,
    NotificationsModule,
    PresenceModule,
    InvitationsModule,
    FriendsModule,
    FilesModule,
    MetricsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: AuthJwtGuard },
    { provide: APP_GUARD, useClass: ServerPermissionsGuard },
    { provide: APP_GUARD, useClass: AppPermissionsGuard },
    { provide: APP_INTERCEPTOR, useClass: CorrelationIdInterceptor },
    { provide: APP_INTERCEPTOR, useClass: HttpCacheInterceptor },
    { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor },
    { provide: APP_INTERCEPTOR, useClass: TransformInterceptor },
    { provide: APP_FILTER, useClass: GlobalExceptionFilter },
  ],
})
export class AppModule {}
