import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { Repository } from 'typeorm';
import { LoggingService } from '../logging/logging.service';
import { ServerMember } from '../servers/entities/server-member.entity';

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

  async findAll(): Promise<User[]> {
    return this.usersRepository.find();
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
        this.logger.warn(
          `User remove requested for missing userId=${id}`,
          UsersService.name,
        );
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
}
