import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LoggingService } from '../../logging/logging.service';
import { User } from 'src/users/entities/user.entity';

@Injectable()
export class AppPermissionsService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,

    private readonly logger: LoggingService,
  ) {
    this.logger.child({ context: AppPermissionsService.name });
  }
  async resolveUserAppRole(userId: string) {
    this.logger.debug(`Resolving app permissions for userId=${userId} `);

    const user = await this.usersRepository.findOne({
      where: { id: userId },
      select: ['id', 'appRole'],
    });
    if (!user) {
      throw new NotFoundException('user does not exist');
    }
    return user.appRole;
  }
}
