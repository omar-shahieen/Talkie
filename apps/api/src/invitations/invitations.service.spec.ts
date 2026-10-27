import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { InvitationsService } from './invitations.service';
import { ServerMember } from '../servers/entities/server-member.entity';
import { Invitation } from './entities/invitation.entity';
import { LoggingService } from '../logging/logging.service';

describe('InvitationsService', () => {
  let service: InvitationsService;

  const mockMembersRepository = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };

  const mockInvitationsRepository = {
    findOne: jest.fn(),
    save: jest.fn(),
    delete: jest.fn(),
  };

  const mockDataSource = {
    createQueryRunner: jest.fn(),
  };

  const mockLoggingService = {
    log: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InvitationsService,
        {
          provide: getRepositoryToken(ServerMember),
          useValue: mockMembersRepository,
        },
        {
          provide: getRepositoryToken(Invitation),
          useValue: mockInvitationsRepository,
        },
        {
          provide: DataSource,
          useValue: mockDataSource,
        },
        {
          provide: LoggingService,
          useValue: mockLoggingService,
        },
      ],
    }).compile();

    service = module.get<InvitationsService>(InvitationsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
