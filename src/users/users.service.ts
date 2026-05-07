import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { Repository } from 'typeorm';
import { LoggingService } from '../logging/logging.service';
import { ServerMember } from '../servers/entities/server-member.entity';
import { UpdateUserDto } from './dtos/updateUser.dto';
import { PaginationDto } from 'src/common/dto/pagination.dto';
import { APIFeatures } from 'src/common/helpers/api-features.helper';
import { PaginatedResult } from 'src/common/dto/paginated-result.dto';
import { NotFoundException } from 'src/common/exceptions/domain.exception';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    @InjectRepository(ServerMember)
    private userMemberRepository: Repository<ServerMember>,

    private readonly logger: LoggingService,
  ) {}

  private redactEmail(email?: string | null): string {
    if (!email) return 'unknown';
    const [name, domain] = email.split('@');
    if (!name || !domain) return 'unknown';
    const maskedName =
      name.length <= 2 ? `${name[0] ?? '*'}*` : `${name.slice(0, 2)}***`;
    return `${maskedName}@${domain}`;
  }

  private async findUserOrThrow(userId: string) {
    const user = await this.usersRepository.findOneBy({ id: userId });
    if (!user)
      throw new NotFoundException('user', userId, {
        userId,
        message: 'User account not found or has been deleted.',
      });
    return user;
  }

  async findAll(q: PaginationDto) {
    const [data, count] = await new APIFeatures(this.usersRepository, q)
      .filter()
      .sorting()
      .limit()
      .pagination()
      .getManyAndCount();

    return new PaginatedResult(data, count, q.page, q.limit);
  }

  async create(user: Partial<User>) {
    const newUser = this.usersRepository.create(user);
    try {
      const savedUser = await this.usersRepository.save(newUser);
      this.logger.log(
        `User created userId=${savedUser.id} email=${this.redactEmail(savedUser.email ?? user.email)}`,
        UsersService.name,
      );
      return savedUser;
    } catch (error) {
      this.logger.logError('User creation failed', error, {
        context: UsersService.name,
        emailRedacted: this.redactEmail(user.email),
      });
      throw error;
    }
  }

  async getUserServerIds(userId: string) {
    const servermembers = await this.userMemberRepository.find({
      select: ['serverId'], // Only fetch this single column
      where: {
        memberId: userId,
      },
    });

    return servermembers.map((sm) => sm.serverId);
  }

  async remove(id: number): Promise<void> {
    try {
      const deleteResult = await this.usersRepository.delete(id);

      if (!deleteResult.affected) {
        this.logger.warn('User remove requested for missing user', {
          action: 'remove',
          userId: id,
        });
        return;
      }

      this.logger.log(`User removed userId=${id}`, UsersService.name);
    } catch (error) {
      this.logger.logError('User removal failed', error, {
        context: UsersService.name,
        userId: id,
      });
      throw error;
    }
  }

  async getProfile(userId: string) {
    const user = await this.findUserOrThrow(userId);
    return user;
  }
  async updateProfile(userId: string, dto: UpdateUserDto) {
    const user = await this.getProfile(userId);

    await this.usersRepository.update(userId, dto); // test this

    return user;
  }
  async deleteProfile(userId: string) {
    const user = await this.findUserOrThrow(userId);

    await this.usersRepository.softRemove(user);

    return { message: 'User deleted successfully' };
  }

  async searchByUsername(q: string, requesterId: string) {
    return this.usersRepository
      .createQueryBuilder('user')
      .select(['user.id', 'user.username', 'user.avatar'])
      .where('u.username ILIKE :q', { q: `${q}%` })
      .andWhere('u.id != :requesterId', { requesterId }) // exclude self
      .limit(20)
      .getMany();
  }
}
