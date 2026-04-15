import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { Repository } from 'typeorm';

type UserHiddenField =
  | 'password'
  | 'currentJwtToken'
  | 'tfaSecret'
  | 'googleId';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
  ) {}

  async findAll(): Promise<User[]> {
    return this.usersRepository.find();
  }

  async create(user: Partial<User>) {
    const newUser = this.usersRepository.create(user);
    return this.usersRepository.save(newUser);
  }
  async update(
    id: string,
    updateUserDto: Partial<User> | undefined,
  ): Promise<User> {
    // 1. Check if the user exists
    const user = await this.usersRepository.preload({
      id: id,
      ...updateUserDto,
    });

    if (!user) {
      throw new NotFoundException(`User #${id} not found`);
    }

    // 2. Save the updated entity
    return this.usersRepository.save(user);
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
  async remove(id: number): Promise<void> {
    await this.usersRepository.delete(id);
  }
}
