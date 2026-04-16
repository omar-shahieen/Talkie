import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { UsersService } from './users.service';
import { User } from './entities/user.entity';
import { LoggingService } from '../logging/logging.service';

describe('UsersService', () => {
  let service: UsersService;

  const mockUsersRepository = {
    find: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    preload: jest.fn(),
    findOneBy: jest.fn(),
    createQueryBuilder: jest.fn(),
    findOneByOrFail: jest.fn(),
    delete: jest.fn(),
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
      UsersService.name,
    );
  });

  it('logs warning and throws when updating a missing user', async () => {
    mockUsersRepository.preload.mockResolvedValueOnce(undefined);

    await expect(
      service.update('missing-id', { firstName: 'Nope' }),
    ).rejects.toThrow(NotFoundException);

    expect(mockLoggingService.warn).toHaveBeenCalledWith(
      'User update rejected: userId=missing-id not found fields=firstName',
      UsersService.name,
    );
  });

  it('logs successful updates with redacted field labels', async () => {
    const updatedUser = { id: 'user-2', email: 'user2@example.com' } as User;

    mockUsersRepository.preload.mockResolvedValueOnce(updatedUser);
    mockUsersRepository.save.mockResolvedValueOnce(updatedUser);

    await expect(
      service.update('user-2', {
        firstName: 'Renamed',
        password: 'new-secret',
      }),
    ).resolves.toEqual(updatedUser);

    expect(mockLoggingService.log).toHaveBeenCalledWith(
      'User updated userId=user-2 fields=firstName,password(redacted)',
      UsersService.name,
    );
  });

  it('logs warning when remove is requested for a missing user', async () => {
    mockUsersRepository.delete.mockResolvedValueOnce({ affected: 0 });

    await expect(service.remove(88)).resolves.toBeUndefined();

    expect(mockLoggingService.warn).toHaveBeenCalledWith(
      'User remove requested for missing userId=88',
      UsersService.name,
    );
  });

  it('logs successful remove operations', async () => {
    mockUsersRepository.delete.mockResolvedValueOnce({ affected: 1 });

    await expect(service.remove(99)).resolves.toBeUndefined();

    expect(mockLoggingService.log).toHaveBeenCalledWith(
      'User removed userId=99',
      UsersService.name,
    );
  });
});
