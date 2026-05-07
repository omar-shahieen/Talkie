import { Injectable } from '@nestjs/common';
import { Invitation } from './entities/invitation.entity';
import { DataSource, Repository } from 'typeorm';
import { ServerMember } from '../servers/entities/server-member.entity';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { LoggingService } from '../logging/logging.service';
import {
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from 'src/common/exceptions/domain.exception';

@Injectable()
export class InvitationsService {
  constructor(
    @InjectRepository(ServerMember)
    private readonly membersRepository: Repository<ServerMember>,
    @InjectRepository(Invitation)
    private readonly invitationsRepository: Repository<Invitation>,
    @InjectDataSource() private dataSource: DataSource,
    private readonly logger: LoggingService,
  ) {}

  private validateInvite(invite: Invitation): void {
    if (invite.expiresAt && invite.expiresAt <= new Date()) {
      this.logger.warn(
        `Invite code validation failed: code expired inviteCode=${invite.inviteCode} expiresAt=${invite.expiresAt.toISOString()}`,
        InvitationsService.name,
      );
      throw new ForbiddenException(
        'This invite code has expired and can no longer be used. Request a new one from the server owner.',
      );
    }
    if (invite.maxUses && invite.maxUses <= invite.currentUses) {
      this.logger.warn(
        `Invite code validation failed: usage limit reached inviteCode=${invite.inviteCode} maxUses=${invite.maxUses} currentUses=${invite.currentUses}`,
        InvitationsService.name,
      );
      throw new ForbiddenException(
        'This invite code has reached its usage limit and can no longer be used. Request a new one from the server owner.',
      );
    }
  }

  async resolveInvitationCode(inviteCode: string) {
    const invite = await this.invitationsRepository.findOne({
      where: { inviteCode },
      relations: ['server'],
    });

    if (!invite) {
      throw new NotFoundException('invite code', inviteCode, {
        inviteCode,
        message: 'This invite code does not exist or has been revoked.',
      });
    }

    this.validateInvite(invite);

    const memberCount = await this.membersRepository.count({
      where: { serverId: invite.serverId },
    });

    return {
      icon: invite.server.icon,
      name: invite.server.name,
      memberCount: memberCount,
    };
  }

  async acceptInviationCode(userId: string, inviteCode: string) {
    await this.dataSource.transaction(async (manager) => {
      const invite = await manager.findOne(Invitation, {
        where: { inviteCode },
        relations: ['server', 'server.members', 'server.roles'],
        lock: { mode: 'pessimistic_write' }, // This row is now locked for others
      });

      if (!invite) {
        throw new NotFoundException('invite code', inviteCode, {
          inviteCode,
          message: 'This invite code does not exist or has been revoked.',
        });
      }

      this.validateInvite(invite);

      const existingMember = invite.server.members.filter(
        (m) => userId === m.memberId,
      )[0];
      if (existingMember) {
        throw new BadRequestException(
          'You are already a member of this server. You do not need to use an invite code again.',
        );
      }

      const everyoneRole = invite.server.roles.filter(
        (role) => role.isEveryone,
      );

      const member = manager.create(ServerMember, {
        serverId: invite.server.id,
        memberId: userId,
        roles: everyoneRole ?? [],
      });

      await manager.save(member);

      invite.currentUses += 1;

      await manager.save(invite);
    });

    return { message: 'user added' };
  }

  async removeInvitation(userId: string, inviteCode: string) {
    const invitaion = await this.invitationsRepository.findOne({
      where: {
        inviteCode,
      },
      relations: ['server'],
    });
    if (!invitaion) {
      throw new NotFoundException('invite code', inviteCode, {
        inviteCode,
        message: 'This invite code does not exist or has been revoked.',
      });
    }

    await this.invitationsRepository.softDelete({ inviteCode });

    return { message: 'invite is revoked successfully' };
  }
  async getUserMemberInvites(userId: string) {
    return this.invitationsRepository.find({
      where: { inviterId: userId },
    });
  }
}
