import { Module } from '@nestjs/common';
import { InvitationsController } from './invitations.controller';
import { InvitationsService } from './invitations.service';
import { Invitation } from './entities/invitation.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ServerMember } from 'src/servers/entities/server-member.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Invitation, ServerMember])],
  providers: [InvitationsService],
  controllers: [InvitationsController],
})
export class InvitationsModule {}
