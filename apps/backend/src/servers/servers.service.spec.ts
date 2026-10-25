import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { ServersService } from './servers.service';
import { Server } from './entities/server.entity';
import { ServerMember } from './entities/server-member.entity';
import { Role } from '../roles/entities/role.entity';
import { Channel } from '../channels/entities/channel.entity';
import { Invitation } from '../invitations/entities/invitation.entity';
import { LoggingService } from '../logging/logging.service';

describe('ServersService', () => {
  let service: ServersService;

  const mockRepository = {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    delete: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn(),
  };

  const mockLoggingService = {
    log: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ServersService,
        {
          provide: getRepositoryToken(Server),
          useValue: mockRepository,
        },
        {
          provide: getRepositoryToken(ServerMember),
          useValue: mockRepository,
        },
        {
          provide: getRepositoryToken(Role),
          useValue: mockRepository,
        },
        {
          provide: getRepositoryToken(Channel),
          useValue: mockRepository,
        },
        {
          provide: getRepositoryToken(Invitation),
          useValue: mockRepository,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: LoggingService,
          useValue: mockLoggingService,
        },
      ],
    }).compile();

    service = module.get<ServersService>(ServersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
