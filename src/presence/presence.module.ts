import { Module } from '@nestjs/common';
import { PresenceService } from './presence.service';
import { CacheModule } from '@nestjs/cache-manager';
import { User } from 'src/users/entities/user.entity';
import { TypeOrmModule } from '@nestjs/typeorm';

@Module({
  imports: [TypeOrmModule.forFeature([User]), CacheModule.register()],
  providers: [PresenceService],
  exports: [PresenceService],
})
export class PresenceModule {}
