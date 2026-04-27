import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Invitation } from './entities/invitation.entity';
import { DataSource, Repository } from 'typeorm';
import { ServerMember } from '../servers/entities/server-member.entity';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';

@Injectable()
export class InvitationsService {
  constructor(
    @InjectRepository(ServerMember)
    private readonly membersRepository: Repository<ServerMember>,
    @InjectRepository(Invitation)
    private readonly invitationsRepository: Repository<Invitation>,
    @InjectDataSource() private dataSource: DataSource,
  ) {}

  private validateInvite(invite: Invitation): void {
    if (invite.expiresAt && invite.expiresAt <= new Date()) {
      throw new ForbiddenException('invite code expired');
    }
    if (invite.maxUses && invite.maxUses <= invite.currentUses) {
      throw new ForbiddenException('invite code uses limit is reached');
    }
  }

  async resolveInvitationCode(inviteCode: string) {
    const invite = await this.invitationsRepository.findOne({
      where: { inviteCode },
      relations: ['server'],
    });

    if (!invite) {
      throw new NotFoundException('invite code does not exist');
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
        throw new NotFoundException('invite code does not exist');
      }

      this.validateInvite(invite);

      const existingMember = invite.server.members.filter(
        (m) => userId === m.memberId,
      )[0];
      if (existingMember) {
        throw new BadRequestException('User is already a member');
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
      throw new NotFoundException('invitation code does not exist');
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
