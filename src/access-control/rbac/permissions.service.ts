// src/permissions/permissions.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { PermissionsBitfield } from './permissions.bitfield';
import { Permission } from './permissions.constants';
import { InjectRepository } from '@nestjs/typeorm';
import { ServerMember } from '../../users/entities/server-member.entity';
import { Server } from '../../servers/entities/server.entity';
import { Repository } from 'typeorm';
import { ChannelOverwrite } from '../../channels/entities/channel-overwrite.entity';
<<<<<<< HEAD
import { LoggingService } from '../../logging/logging.service';
=======
import { Channel } from '../../channels/entities/channel.entity';
>>>>>>> 94bb6182375aedd915386855484f9a84710886df

@Injectable()
export class PermissionsService {
  constructor(
    @InjectRepository(Channel)
    private readonly channelsRepository: Repository<Channel>,
    @InjectRepository(Server)
    private readonly serversRepository: Repository<Server>,
    @InjectRepository(ServerMember)
<<<<<<< HEAD
    private readonly memberRepository: Repository<ServerMember>,
    private readonly logger: LoggingService,
=======
    private readonly membersRepository: Repository<ServerMember>,
    @InjectRepository(ChannelOverwrite)
    private readonly overwritesRepository: Repository<ChannelOverwrite>,
>>>>>>> 94bb6182375aedd915386855484f9a84710886df
  ) {}

  async resolve(
    userId: string,
    serverId: string | undefined,
    channelId: string,
  ): Promise<PermissionsBitfield> {
<<<<<<< HEAD
    this.logger.debug(
      `Resolving permissions for userId=${userId} serverId=${serverId} channelId=${channelId}`,
      PermissionsService.name,
    );
    const server = await this.serverRepository.findOneByOrFail({
      id: serverId,
=======
    return this.resolveForChannel(userId, serverId, channelId);
  }

  async resolveForChannel(
    userId: string,
    serverId: string | undefined,
    channelId: string,
  ): Promise<PermissionsBitfield> {
    const channel = await this.channelsRepository.findOneBy({ id: channelId });
    if (!channel) {
      throw new NotFoundException('Channel not found');
    }

    const effectiveServerId = serverId ?? channel.serverId;
    const server = await this.serversRepository.findOneBy({
      id: effectiveServerId,
>>>>>>> 94bb6182375aedd915386855484f9a84710886df
    });
    if (!server) {
      throw new NotFoundException('Server not found');
    }

    // Step 1 — owner bypass
    if (server.ownerId === userId) {
      return PermissionsBitfield.from(~0n);
    }

    const member = await this.membersRepository.findOne({
      where: {
        serverId: effectiveServerId,
        userId,
      },
      relations: ['roles'],
    });
    if (!member) {
      throw new NotFoundException('Server member not found');
    }

    // Step 2+3 — compute base permissions via bitwise OR of all roles
    let base = 0n;
    for (const role of member.roles) {
      base |= BigInt(role.permissions);
    }
    let perms = PermissionsBitfield.from(base);

    // Administrator bypass (checked after computing base)
    if (perms.has(Permission.Administrator)) {
      return PermissionsBitfield.from(~0n);
    }

    const overwrites = await this.overwritesRepository.findBy({ channelId });

    // Step 4 — @everyone channel overwrite
    const everyoneRole = member.roles.find((r) => r.isEveryone);

    if (everyoneRole) {
      perms = this.applyOverwrite(perms, overwrites, everyoneRole.id, 'role');
    }

    // Step 5 — role overwrites (sorted by position ascending)
    const sortedRoles = [...member.roles]
      .filter((r) => !r.isEveryone)
      .sort((a, b) => a.position - b.position);

    for (const role of sortedRoles) {
      perms = this.applyOverwrite(perms, overwrites, role.id, 'role');
    }

    // Step 6 — user-specific overwrite
    perms = this.applyOverwrite(perms, overwrites, userId, 'user');

    this.logger.debug(
      `Resolved permissions for userId=${userId} channelId=${channelId} bitfield=${perms.toJSON()}`,
      PermissionsService.name,
    );

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
