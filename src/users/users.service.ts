import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { Repository } from 'typeorm';
import { LoggingService } from '../logging/logging.service';
import { ServerMember } from './entities/server-member.entity';

type UserHiddenField =
  | 'password'
  | 'currentJwtToken'
  | 'tfaSecret'
  | 'googleId';

const SENSITIVE_UPDATE_FIELDS = new Set([
  'password',
  'currentJwtToken',
  'tfaSecret',
  'googleId',
]);

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

  private getUpdatedFieldNames(
    updateUserDto: Partial<User> | undefined,
  ): string {
    const fields = Object.keys(updateUserDto ?? {});
    if (!fields.length) {
      return 'none';
    }

    return fields
      .map((field) =>
        SENSITIVE_UPDATE_FIELDS.has(field) ? `${field}(redacted)` : field,
      )
      .join(',');
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

  async update(
    id: string,
    updateUserDto: Partial<User> | undefined,
  ): Promise<User> {
    const updatedFieldNames = this.getUpdatedFieldNames(updateUserDto);

    // 1. Check if the user exists
    let user: User | undefined;
    try {
      user = await this.usersRepository.preload({
        id: id,
        ...updateUserDto,
      });
    } catch (error) {
      this.logger.logError('User preload failed', error, {
        context: UsersService.name,
        userId: id,
        updatedFieldNames,
      });
      throw error;
    }

    if (!user) {
      this.logger.warn(
        `User update rejected: userId=${id} not found fields=${updatedFieldNames}`,
        UsersService.name,
      );
      throw new NotFoundException(`User #${id} not found`);
    }

    // 2. Save the updated entity
    try {
      const savedUser = await this.usersRepository.save(user);
      this.logger.log(
        `User updated userId=${id} fields=${updatedFieldNames}`,
        UsersService.name,
      );
      return savedUser;
    } catch (error) {
      this.logger.logError('User update failed', error, {
        context: UsersService.name,
        userId: id,
        updatedFieldNames,
      });
      throw error;
    }
  }

  async findById(id: string): Promise<User | null> {
    return this.usersRepository.findOneBy({ id });
  }

  private createQueryWithHiddenFields(hiddenFields: UserHiddenField[]) {
    const query = this.usersRepository.createQueryBuilder('user');

    for (const field of hiddenFields) {
      query.addSelect(`user.${field}`);
    }

    return query;
  }

  async findByEmailWithPassword(email: string): Promise<User | null> {
    return this.createQueryWithHiddenFields(['password'])
      .where('user.email = :email', { email })
      .getOne();
  }

  async findByIdWithRefreshToken(id: string): Promise<User | null> {
    return this.createQueryWithHiddenFields(['currentJwtToken'])
      .where('user.id = :id', { id })
      .getOne();
  }

  async findByIdWithTfaSecret(id: string): Promise<User | null> {
    return this.createQueryWithHiddenFields(['tfaSecret'])
      .where('user.id = :id', { id })
      .getOne();
  }

  async findByEmailWithSecrets(email: string): Promise<User | null> {
    return this.createQueryWithHiddenFields([
      'password',
      'currentJwtToken',
      'tfaSecret',
      'googleId',
    ])
      .where('user.email = :email', { email })
      .getOne();
  }

  async findJwtToken(jwtToken: string) {
    return this.usersRepository.findOneByOrFail({ currentJwtToken: jwtToken });
  }

  async getUserServerIds(userId: string) {
    const servermembers = await this.userMemberRepository.find({
      select: ['serverId'], // Only fetch this single column
      where: {
        userId,
      },
    });

    return servermembers.map((sm) => sm.serverId);
  }

  async findOne(id: string): Promise<User> {
    const user = await this.findById(id);
    if (!user) {
      throw new NotFoundException(`User #${id} not found`);
    }
    return user;
  }

  async updateStatusPreference(
    userId: string,
    data: { status_preference: 'dnd'; dnd_until: Date | null },
  ) {
    await this.usersRepository.update(userId, data);
  }

  async clearStatusPreference(userId: string) {
    await this.usersRepository.update(userId, {
      status_preference: null,
      dnd_until: null,
    });
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
