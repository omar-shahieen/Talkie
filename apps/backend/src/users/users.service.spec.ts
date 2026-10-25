import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { UsersService } from './users.service';
import { User } from './entities/user.entity';
import { ServerMember } from '../servers/entities/server-member.entity';
import { LoggingService } from '../logging/logging.service';
import { NotFoundException } from '../common/exceptions/domain.exception';

describe('UsersService', () => {
  let service: UsersService;

  const mockQueryBuilder = {
    addSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    getOne: jest.fn(),
  };

  const mockUsersRepository = {
    find: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    findOneBy: jest.fn(),
    createQueryBuilder: jest.fn(() => mockQueryBuilder),
    update: jest.fn(),
    delete: jest.fn(),
    softRemove: jest.fn(),
  };

  const mockServerMemberRepository = {
    find: jest.fn(),
  };

  const mockLoggingService = {
    log: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    error: jest.fn(),
    logError: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: getRepositoryToken(User),
          useValue: mockUsersRepository,
        },
        {
          provide: getRepositoryToken(ServerMember),
          useValue: mockServerMemberRepository,
        },
        {
          provide: LoggingService,
          useValue: mockLoggingService,
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('logs successful user creation with redacted email', async () => {
    const input = { email: 'newuser@example.com', username: 'newuser' };
    const createdUser = { id: 'user-1', ...input } as User;

    mockUsersRepository.create.mockReturnValueOnce(createdUser);
    mockUsersRepository.save.mockResolvedValueOnce(createdUser);

    await expect(service.create(input)).resolves.toEqual(createdUser);

    expect(mockLoggingService.log).toHaveBeenCalledWith(
      'User created userId=user-1 email=ne***@example.com',
      {
        context: UsersService.name,
        action: 'create',
        userId: 'user-1',
        email: 'ne***@example.com',
      },
    );
  });

  it('throws NotFoundException when updating profile of a missing user', async () => {
    mockQueryBuilder.getOne.mockResolvedValueOnce(null);

    await expect(
      service.updateProfile('missing-id', { firstName: 'Nope' }),
    ).rejects.toThrow(NotFoundException);
  });

  it('successfully updates user profile', async () => {
    const existingUser = { id: 'user-2', firstName: 'Old' } as User;
    mockQueryBuilder.getOne.mockResolvedValueOnce(existingUser);
    mockUsersRepository.update.mockResolvedValueOnce({ affected: 1 });

    const result = await service.updateProfile('user-2', {
      firstName: 'Renamed',
    });

    expect(result).toEqual(existingUser);
    expect(mockUsersRepository.update).toHaveBeenCalledWith('user-2', {
      firstName: 'Renamed',
    });
  });

  it('logs warning when remove is requested for a missing user', async () => {
    mockUsersRepository.delete.mockResolvedValueOnce({ affected: 0 });

    await expect(service.remove(88)).resolves.toBeUndefined();

    expect(mockLoggingService.warn).toHaveBeenCalledWith(
      'User remove requested for missing user',
      {
        context: UsersService.name,
        action: 'remove',
        userId: 88,
      },
    );
  });

  it('logs successful remove operations', async () => {
    mockUsersRepository.delete.mockResolvedValueOnce({ affected: 1 });

    await expect(service.remove(99)).resolves.toBeUndefined();

    expect(mockLoggingService.log).toHaveBeenCalledWith(
      'User removed userId=99',
      {
        context: UsersService.name,
        action: 'remove',
        userId: 99,
      },
    );
  });
});
