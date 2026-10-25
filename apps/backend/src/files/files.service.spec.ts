import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { FilesService } from './files.service';
import { StorageService } from './storage.service';
import { LoggingService } from '../logging/logging.service';
import { Channel } from '../channels/entities/channel.entity';
import { ChannelMember } from '../channels/entities/channel-member.entity';
import { ServerMember } from '../servers/entities/server-member.entity';

describe('FilesService', () => {
  let service: FilesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FilesService,
        { provide: getRepositoryToken(Channel), useValue: {} },
        { provide: getRepositoryToken(ChannelMember), useValue: {} },
        { provide: getRepositoryToken(ServerMember), useValue: {} },
        { provide: StorageService, useValue: { upload: jest.fn() } },
        { provide: LoggingService, useValue: { log: jest.fn(), error: jest.fn() } },
      ],
    }).compile();

    service = module.get<FilesService>(FilesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
