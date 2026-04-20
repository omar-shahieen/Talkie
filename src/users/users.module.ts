import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { UsersController } from './users.controller';
import { UserSubscriber } from './user.subscriber';
import { ServerMember } from './entities/server-member.entity';

@Module({
  imports: [TypeOrmModule.forFeature([User, ServerMember])],
  providers: [UsersService, UserSubscriber],
  exports: [UsersService, TypeOrmModule],
  controllers: [UsersController],
})
export class UsersModule {}
