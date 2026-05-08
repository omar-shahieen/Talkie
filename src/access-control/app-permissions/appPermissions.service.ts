import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LoggingService } from '../../logging/logging.service';
import { User } from 'src/users/entities/user.entity';
import { NotFoundException } from 'src/common/exceptions/domain.exception';

@Injectable()
export class AppPermissionsService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,

    private readonly logger: LoggingService,
  ) {}
  async resolveUserAppRole(userId: string) {
    this.logger.debug(`Resolving app permissions for userId=${userId} `);

    const user = await this.usersRepository.findOne({
      where: { id: userId },
      select: ['id', 'appRole'],
    });
    if (!user) {
      throw new NotFoundException('user', userId, {
        userId,
        message: 'User account not found. Cannot retrieve permissions.',
      });
    }
    return user.appRole;
  }
}
