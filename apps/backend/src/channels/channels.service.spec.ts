import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ChannelsService } from './channels.service';
import { Channel } from './entities/channel.entity';
import { ReadState } from './entities/readState.entity';
import { ServerPermissionsService } from '../access-control/server-permissions/serverPermissions.service';

describe('ChannelsService', () => {
  let service: ChannelsService;

  const mockChannelRepository = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOneBy: jest.fn(),
  };

  const mockReadStatesRepository = {
    find: jest.fn(),
    save: jest.fn(),
  };

  const mockPermissionsService = {
    getUserPermissionsInChannel: jest.fn(),
  };

  const mockDataSource = {
    createQueryRunner: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChannelsService,
        {
          provide: getRepositoryToken(Channel),
          useValue: mockChannelRepository,
        },
        {
          provide: getRepositoryToken(ReadState),
          useValue: mockReadStatesRepository,
        },
        {
          provide: ServerPermissionsService,
          useValue: mockPermissionsService,
        },
        {
          provide: DataSource,
          useValue: mockDataSource,
        },
      ],
    }).compile();

    service = module.get<ChannelsService>(ChannelsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
