import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { CreateServerDto } from './dto/create-server.dto';
import { UpdateServerDto } from './dto/update-server.dto';
import { Server } from './entities/server.entity';
import { Repository } from 'typeorm';
import { ServerMember } from '../users/entities/server-member.entity';
import { Role } from '../roles/entities/role.entity';
import { Channel } from '../channels/entities/channel.entity';
import { Permission } from '../access-control/rbac/permissions.constants';
import { JoinServerDto } from './dto/join-server.dto';
import { DiscoverServersDto } from './dto/discover-servers.dto';
import { randomBytes } from 'crypto';

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
  ) {}

  async create(createServerDto: CreateServerDto): Promise<Server> {
    const inviteCode = await this.resolveInviteCode(createServerDto.inviteCode);
    const tags = this.normalizeTags(createServerDto.tags);

    const server = this.serversRepository.create({
      name: createServerDto.name,
      ownerId: createServerDto.ownerId,
      isPublic: createServerDto.isPublic ?? false,
      description: createServerDto.description,
      category: createServerDto.category,
      tags,
      inviteCode,
    });
    const created = await this.serversRepository.save(server);

    const everyoneRole = this.rolesRepository.create({
      serverId: created.id,
      name: '@everyone',
      position: 0,
      permissions: (Permission.ViewChannel | Permission.SendMessages).toString(),
      isEveryone: true,
    });
    const savedEveryoneRole = await this.rolesRepository.save(everyoneRole);

    const ownerMember = this.membersRepository.create({
      serverId: created.id,
      userId: created.ownerId,
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
      where: { userId },
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
      throw new NotFoundException('Server not found');
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

  async joinByInvite(payload: JoinServerDto): Promise<ServerMember> {
    const inviteCode = payload.inviteCode.trim();
    if (!inviteCode) {
      throw new BadRequestException('Invite code is required');
    }

    const server = await this.serversRepository.findOneBy({ inviteCode });
    if (!server) {
      throw new NotFoundException('Invite code is invalid');
    }

    const existingMember = await this.membersRepository.findOneBy({
      serverId: server.id,
      userId: payload.userId,
    });
    if (existingMember) {
      throw new BadRequestException('User is already a member');
    }

    const everyoneRole = await this.rolesRepository.findOneBy({
      serverId: server.id,
      isEveryone: true,
    });

    const member = this.membersRepository.create({
      serverId: server.id,
      userId: payload.userId,
      roles: everyoneRole ? [everyoneRole] : [],
    });
    return this.membersRepository.save(member);
  }

  async leaveServer(serverId: string, userId: string): Promise<void> {
    const server = await this.findOne(serverId);
    if (server.ownerId === userId) {
      throw new BadRequestException(
        'Owner cannot leave server before transferring ownership',
      );
    }

    const member = await this.membersRepository.findOneBy({ serverId, userId });
    if (!member) {
      throw new NotFoundException('Server member not found');
    }

    await this.membersRepository.remove(member);
  }

  async remove(id: string, requesterId: string): Promise<void> {
    const server = await this.findOne(id);
    if (!requesterId) {
      throw new BadRequestException('requesterId is required');
    }
    if (server.ownerId !== requesterId) {
      throw new ForbiddenException('Only the owner can delete the server');
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

  private async resolveInviteCode(inviteCode: string | undefined): Promise<string> {
    const requested = inviteCode?.trim();
    if (requested) {
      const existing = await this.serversRepository.findOneBy({
        inviteCode: requested,
      });
      if (existing) {
        throw new BadRequestException('Invite code is already used');
      }
      return requested;
    }

    let generated = '';
    // Retry until unique code is found.
    do {
      generated = randomBytes(4).toString('hex');
      // eslint-disable-next-line no-await-in-loop
    } while (await this.serversRepository.findOneBy({ inviteCode: generated }));

    return generated;
  }
}
