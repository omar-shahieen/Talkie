import { Injectable } from '@nestjs/common';

import { InjectRepository } from '@nestjs/typeorm';
import { CreateServerDto } from './dto/create-server.dto';
import { UpdateServerDto } from './dto/update-server.dto';
import { Server } from './entities/server.entity';
import { Repository } from 'typeorm';
import { ServerMember } from './entities/server-member.entity';
import { Role } from '../roles/entities/role.entity';
import { Channel } from '../channels/entities/channel.entity';
import { Permission } from '../access-control/server-permissions/serverPermissions.constants';
import { DiscoverServersDto } from './dto/discover-servers.dto';
import { randomBytes } from 'crypto';
import { ConfigService } from '@nestjs/config';
import { Invitation } from '../invitations/entities/invitation.entity';
import { CreateInvitationDto } from './dto/create-invititaion.dto';
import {
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from 'src/common/exceptions/domain.exception';
import { LoggingService } from '../logging/logging.service';
@Injectable()
export class ServersService {
  constructor(
    @InjectRepository(Server)
    private readonly serversRepository: Repository<Server>,
    @InjectRepository(ServerMember)
    private readonly membersRepository: Repository<ServerMember>,
    @InjectRepository(Role)
    private readonly rolesRepository: Repository<Role>,
    @InjectRepository(Channel)
    private readonly channelsRepository: Repository<Channel>,
    @InjectRepository(Invitation)
    private readonly invitationsRepository: Repository<Invitation>,
    private readonly configService: ConfigService,
    private readonly logger: LoggingService,
  ) {}

  async create(createServerDto: CreateServerDto): Promise<Server> {
    const tags = this.normalizeTags(createServerDto.tags);

    const server = this.serversRepository.create({
      name: createServerDto.name,
      ownerId: createServerDto.ownerId,
      isPublic: createServerDto.isPublic ?? false,
      description: createServerDto.description,
      category: createServerDto.category,
      tags,
    });
    const created = await this.serversRepository.save(server);

    const everyoneRole = this.rolesRepository.create({
      serverId: created.id,
      name: '@everyone',
      position: 0,
      permissions: (
        Permission.ViewChannel | Permission.SendMessages
      ).toString(),
      isEveryone: true,
    });
    const savedEveryoneRole = await this.rolesRepository.save(everyoneRole);

    const ownerMember = this.membersRepository.create({
      serverId: created.id,
      memberId: created.ownerId,
      roles: [savedEveryoneRole],
    });
    await this.membersRepository.save(ownerMember);

    const generalChannel = this.channelsRepository.create({
      serverId: created.id,
      name: 'general',
    });
    await this.channelsRepository.save(generalChannel);

    return created;
  }

  async findAll(): Promise<Server[]> {
    return this.serversRepository.find();
  }

  async findForUser(userId: string): Promise<Server[]> {
    const memberships = await this.membersRepository.find({
      where: { memberId: userId },
      relations: ['server'],
    });

    return memberships
      .map((membership) => membership.server)
      .filter((server): server is Server => Boolean(server));
  }

  async discover(query: DiscoverServersDto): Promise<Server[]> {
    const qb = this.serversRepository
      .createQueryBuilder('server')
      .where('server.isPublic = :isPublic', { isPublic: true });

    if (query.q?.trim()) {
      qb.andWhere('(server.name ILIKE :q OR server.description ILIKE :q)', {
        q: `%${query.q.trim()}%`,
      });
    }

    if (query.category?.trim()) {
      qb.andWhere('server.category = :category', {
        category: query.category.trim(),
      });
    }

    const requestedTags = this.normalizeTags(
      query.tags
        ? query.tags
            .split(',')
            .map((tag) => tag.trim())
            .filter(Boolean)
        : undefined,
    );

    if (requestedTags.length) {
      for (let i = 0; i < requestedTags.length; i += 1) {
        qb.andWhere(`server.tags ILIKE :tag${i}`, {
          [`tag${i}`]: `%${requestedTags[i]}%`,
        });
      }
    }

    return qb.getMany();
  }

  async findOne(id: string): Promise<Server> {
    const server = await this.serversRepository.findOneBy({ id });
    if (!server) {
      throw new NotFoundException('server', id, {
        serverId: id,
        message: 'This server does not exist or has been deleted.',
      });
    }
    return server;
  }

  async update(id: string, updateServerDto: UpdateServerDto): Promise<Server> {
    const server = await this.findOne(id);
    const next = { ...updateServerDto };
    if (next.tags) {
      next.tags = this.normalizeTags(next.tags);
    }
    Object.assign(server, next);
    return this.serversRepository.save(server);
  }

  async leaveServer(serverId: string, userId: string): Promise<void> {
    const server = await this.findOne(serverId);
    if (server.ownerId === userId) {
      throw new BadRequestException(
        'You cannot leave this server as the owner. Please transfer ownership to another member first, then you can leave.',
        {
          action: 'leaveServer',
          serverId,
          userId,
        },
      );
    }

    const member = await this.membersRepository.findOneBy({
      serverId,
      memberId: userId,
    });
    if (!member) {
      throw new NotFoundException('server member', `${serverId}:${userId}`, {
        serverId,
        userId,
        message:
          'You are not a member of this server or membership has been removed.',
      });
    }

    await this.membersRepository.remove(member);
  }

  async remove(id: string, requesterId: string): Promise<void> {
    const server = await this.findOne(id);
    if (!requesterId) {
      this.logger.error('Server deletion failed: requester ID missing', {
        action: 'remove',
        serverId: id,
      });
      throw new BadRequestException(
        'The requester ID is missing. Unable to process server deletion without authentication.',
        {
          action: 'remove',
          serverId: id,
        },
      );
    }
    if (server.ownerId !== requesterId) {
      throw new ForbiddenException(
        'Only the server owner can delete the server. Contact the owner if you want the server removed.',
        {
          action: 'remove',
          serverId: id,
          requesterId,
        },
      );
    }

    await this.serversRepository.remove(server);
  }

  private normalizeTags(tags: string[] | undefined): string[] {
    if (!tags?.length) {
      return [];
    }

    const normalized = tags
      .map((tag) => tag.trim().toLowerCase())
      .filter(Boolean);

    return [...new Set(normalized)];
  }

  async createInviation(
    inviterId: string,
    serverId: string,
    { expiresInHours, maxUses }: CreateInvitationDto,
  ) {
    // find the server
    const server = await this.serversRepository.findOne({
      where: { id: serverId },
    });
    if (!server) {
      throw new NotFoundException('server', serverId, {
        action: 'createInvitation',
        serverId,
        message: 'This server does not exist or has been deleted.',
      });
    }

    // check if the user is servermember
    const member = await this.membersRepository.findOne({
      where: { serverId, memberId: inviterId },
      relations: ['roles'],
    });

    if (!member) {
      throw new NotFoundException('server member', `${serverId}:${inviterId}`, {
        action: 'createInvitation',
        serverId,
        userId: inviterId,
        message: 'You must be a member of the server to create invitations.',
      });
    }

    // generate invite code and invitaion record
    const inviteCode = randomBytes(8).toString('hex'); // 16 chars

    let expirationDate: null | Date = null;
    if (expiresInHours) {
      expirationDate = new Date();

      // Add hours (converted to milliseconds)
      expirationDate.setTime(
        expirationDate.getTime() + expiresInHours * 60 * 60 * 1000,
      );
    }

    const invitaion = this.invitationsRepository.create({
      inviteCode,
      expiresAt: expirationDate,
      maxUses,
      serverId,
      inviterId,
    });

    await this.invitationsRepository.save(invitaion);

    // build frontend url

    const frontendUrl = `${this.configService.get<string>('FRONTEND_END_URL')}/invite/${inviteCode}`;

    return frontendUrl;
  }

  async findUserInvitations(userId: string, serverId: string) {
    const member = await this.membersRepository.findOneBy({
      memberId: userId,
      serverId,
    });
    if (!member) {
      throw new ForbiddenException(
        'You are not a member of this server. Join the server first to perform this action.',
        {
          action: 'findUserInvitations',
          serverId,
          userId,
        },
      );
    }
    return this.invitationsRepository.find({
      where: { inviterId: userId, serverId },
      order: {
        createdAt: 'DESC', // Newest first
      },
    });
  }
}
