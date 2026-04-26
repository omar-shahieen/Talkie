import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { CreateServerDto } from './dto/create-server.dto';
import { UpdateServerDto } from './dto/update-server.dto';
import { Server } from './entities/server.entity';
import { DataSource, Repository } from 'typeorm';
import { ServerMember } from '../users/entities/server-member.entity';
import { Role } from '../roles/entities/role.entity';
import { Channel } from '../channels/entities/channel.entity';
import { Permission } from '../access-control/rbac/permissions.constants';
import { DiscoverServersDto } from './dto/discover-servers.dto';
import { randomBytes } from 'crypto';
import { InvitationDto } from './dto/invititaion.dto';
import { PermissionsBitfield } from 'src/access-control/rbac/permissions.bitfield';
import { ConfigService } from '@nestjs/config';
import { Invitation } from './entities/invitation.entity';
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
    @InjectDataSource() private dataSource: DataSource,
    private readonly configService: ConfigService,
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

  async leaveServer(serverId: string, userId: string): Promise<void> {
    const server = await this.findOne(serverId);
    if (server.ownerId === userId) {
      throw new BadRequestException(
        'Owner cannot leave server before transferring ownership',
      );
    }

    const member = await this.membersRepository.findOneBy({
      serverId,
      memberId: userId,
    });
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

  async createInviation(
    inviterId: string,
    serverId: string,
    { expiresInHours, maxUses }: InvitationDto,
  ) {
    // find the server
    const server = await this.serversRepository.findOne({
      where: { id: serverId },
    });
    if (!server) {
      throw new NotFoundException('server does not exist');
    }

    // check if the user is servermember
    const member = await this.membersRepository.findOne({
      where: { serverId, memberId: inviterId },
      relations: ['roles'],
    });

    if (!member) {
      throw new NotFoundException('member does not exist');
    }

    // check if user has admin privilage

    const isAdmin = member.roles.some(
      (role) =>
        !role.isEveryone &&
        PermissionsBitfield.from(role.permissions).has(
          Permission.Administrator,
        ),
    );
    if (!isAdmin) {
      throw new ForbiddenException(
        'user has no permission to generate invitation',
      );
    }

    // generate invite code and invitaion record
    const inviteCode = randomBytes(4).toString('hex'); // 8 chars
    console.log(inviteCode); // e.g., "f3a2b1c0"

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

  private validateInvite(invite: Invitation): void {
    if (invite.expiresAt && invite.expiresAt <= new Date()) {
      throw new ForbiddenException('invite code expired');
    }
    if (invite.maxUses && invite.maxUses <= invite.currentUses) {
      throw new ForbiddenException('invite code uses limit is reached');
    }
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
}
