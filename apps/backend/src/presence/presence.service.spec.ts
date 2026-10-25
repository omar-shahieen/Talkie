import { Test, TestingModule } from '@nestjs/testing';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { getRepositoryToken } from '@nestjs/typeorm';
import { PresenceService } from './presence.service';
import { LoggingService } from '../logging/logging.service';
import { User } from '../users/entities/user.entity';

describe('PresenceService', () => {
  let service: PresenceService;

  const mockCache = {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
  };

  const mockLoggingService = {
    log: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };

  const mockUserRepository = {
    findOne: jest.fn(),
    save: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PresenceService,
        {
          provide: CACHE_MANAGER,
          useValue: mockCache,
        },
        {
          provide: LoggingService,
          useValue: mockLoggingService,
        },
        {
          provide: getRepositoryToken(User),
          useValue: mockUserRepository,
        },
      ],
    }).compile();

    service = module.get<PresenceService>(PresenceService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
