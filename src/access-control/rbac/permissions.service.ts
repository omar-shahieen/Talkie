// src/permissions/permissions.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { PermissionsBitfield } from './permissions.bitfield';
import { Permission } from './permissions.constants';
import { Repository } from 'typeorm';
import { Channel } from '../../channels/entities/channel.entity';
import { ChannelOverwrite } from '../../channels/entities/channel-overwrite.entity';
import { Server } from '../../servers/entities/server.entity';
import { ServerMember } from '../../users/entities/server-members.entity';

export interface ResolutionTrace {
  step: string;
  bits: string;
  grantedPermissions: string[];
}

export interface ResolutionResult {
  userId: string;
  serverId: string;
  channelId: string;
  allowed: boolean;
  finalPermissions: string[];
  trace: ResolutionTrace[];
}

@Injectable()
export class PermissionsService {
  constructor(
    @InjectRepository(Channel)
    private readonly channelsRepository: Repository<Channel>,
    @InjectRepository(Server)
    private readonly serversRepository: Repository<Server>,
    @InjectRepository(ServerMember)
    private readonly membersRepository: Repository<ServerMember>,
    @InjectRepository(ChannelOverwrite)
    private readonly overwritesRepository: Repository<ChannelOverwrite>,
  ) {}

  async resolve(
    userId: string,
    serverId: string | undefined,
    channelId: string,
  ): Promise<PermissionsBitfield> {
    const channel = await this.channelsRepository.findOneBy({ id: channelId });
    if (!channel) throw new NotFoundException();

    const effectiveServerId = serverId ?? channel.serverId;
    const server = await this.serversRepository.findOneBy({
      id: effectiveServerId,
    });
    if (!server) throw new NotFoundException();

    const member = await this.membersRepository.findOne({
      where: { userId, serverId: effectiveServerId },
      relations: { roles: true },
    });
    if (!member) throw new NotFoundException();

    const memberRoles = member.roles ?? [];

    // Step 1 — owner bypass
    if (server.ownerId === userId) {
      return PermissionsBitfield.from(~0n);
    }

    // Step 2+3 — compute base permissions via bitwise OR of all roles
    let base = 0n;
    for (const role of memberRoles) {
      base |= BigInt(role.permissions);
    }
    let perms = PermissionsBitfield.from(base);

    // Administrator bypass (checked after computing base)
    if (perms.has(Permission.Administrator)) {
      return PermissionsBitfield.from(~0n);
    }

    const overwrites = await this.overwritesRepository.findBy({ channelId });

    // Step 4 — @everyone channel overwrite
    const everyoneRole = memberRoles.find((r) => r.isEveryone);

    if (everyoneRole) {
      perms = this.applyOverwrite(perms, overwrites, everyoneRole.id, 'role');
    }

    // Step 5 — role overwrites (sorted by position ascending)
    const sortedRoles = [...memberRoles]
      .filter((r) => !r.isEveryone)
      .sort((a, b) => a.position - b.position);

    for (const role of sortedRoles) {
      perms = this.applyOverwrite(perms, overwrites, role.id, 'role');
    }

    // Step 6 — user-specific overwrite
    perms = this.applyOverwrite(perms, overwrites, userId, 'user');

    return perms;
  }

  private applyOverwrite(
    perms: PermissionsBitfield,
    overwrites: ChannelOverwrite[],
    targetId: string,
    targetType: 'role' | 'user',
  ): PermissionsBitfield {
    const overwrite = overwrites.find(
      (o) => o.targetId === targetId && o.targetType === targetType,
    );
    if (!overwrite) return perms;

    const allow = BigInt(overwrite.allow);
    const deny = BigInt(overwrite.deny);

    return perms.remove(deny).add(allow);
  }
}
