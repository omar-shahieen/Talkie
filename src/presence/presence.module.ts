import { Module } from '@nestjs/common';
import { PresenceService } from './presence.service';
import { UsersModule } from '../users/users.module';
import { CacheModule } from '@nestjs/cache-manager';
import { LoggingModule } from '../logging/logging.module';

@Module({
  imports: [UsersModule, CacheModule.register(), LoggingModule],
  providers: [PresenceService],
  exports: [PresenceService],
})
export class PresenceModule {}
