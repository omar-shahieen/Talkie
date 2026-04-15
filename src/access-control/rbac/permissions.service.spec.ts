import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { PermissionsService } from './permissions.service';
import { ChannelOverwrite } from '../../channels/entities/channel-overwrite.entity';
import { Server } from '../../servers/entities/server.entity';
import { ServerMember } from '../../users/entities/server-member.entity';
import { Permission } from './permissions.constants';
import { LoggingService } from '../../logging/logging.service';

describe('PermissionsService', () => {
  let service: PermissionsService;

  const channelOverwritesRepository = {
    find: jest.fn(),
  };

  const serverRepository = {
    findOneByOrFail: jest.fn(),
  };

  const memberRepository = {
    findOneOrFail: jest.fn(),
  };

  const mockLoggingService = {
    debug: jest.fn(),
    warn: jest.fn(),
    log: jest.fn(),
    error: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PermissionsService,
        {
          provide: getRepositoryToken(ChannelOverwrite),
          useValue: channelOverwritesRepository,
        },
        {
          provide: getRepositoryToken(Server),
          useValue: serverRepository,
        },
        {
          provide: getRepositoryToken(ServerMember),
          useValue: memberRepository,
        },
        {
          provide: LoggingService,
          useValue: mockLoggingService,
        },
      ],
    }).compile();

    service = module.get<PermissionsService>(PermissionsService);
  });

  it('returns all permissions for server owner', async () => {
    serverRepository.findOneByOrFail.mockResolvedValueOnce({
      id: 'server-1',
      ownerId: 'owner-1',
    });

    const result = await service.resolveForChannel(
      'owner-1',
      'server-1',
      'channel-1',
    );

    expect(result.has(Permission.ManageMessages)).toBe(true);
    expect(result.has(Permission.Administrator)).toBe(true);
  });

  it('returns all permissions when member has Administrator role', async () => {
    serverRepository.findOneByOrFail.mockResolvedValueOnce({
      id: 'server-1',
      ownerId: 'owner-1',
    });
    memberRepository.findOneOrFail.mockResolvedValueOnce({
      roles: [
        {
          id: 'role-everyone',
          isEveryone: true,
          position: 0,
          permissions: (
            Permission.ViewChannel | Permission.SendMessages
          ).toString(),
        },
        {
          id: 'role-admin',
          isEveryone: false,
          position: 10,
          permissions: Permission.Administrator.toString(),
        },
      ],
    });

    const result = await service.resolveForChannel(
      'user-1',
      'server-1',
      'channel-1',
    );

    expect(result.has(Permission.BanMembers)).toBe(true);
  });

  it('applies channel role overwrite to deny send messages for everyone role', async () => {
    serverRepository.findOneByOrFail.mockResolvedValueOnce({
      id: 'server-1',
      ownerId: 'owner-1',
    });
    memberRepository.findOneOrFail.mockResolvedValueOnce({
      roles: [
        {
          id: 'role-everyone',
          isEveryone: true,
          position: 0,
          permissions: (
            Permission.ViewChannel | Permission.SendMessages
          ).toString(),
        },
      ],
    });
    channelOverwritesRepository.find.mockResolvedValueOnce([
      {
        targetId: 'role-everyone',
        targetType: 'role',
        allow: '0',
        deny: Permission.SendMessages.toString(),
      },
    ]);

    const result = await service.resolveForChannel(
      'member-1',
      'server-1',
      'channel-1',
    );

    expect(result.has(Permission.ViewChannel)).toBe(true);
    expect(result.has(Permission.SendMessages)).toBe(false);
  });

  it('applies user overwrite after role overwrites', async () => {
    serverRepository.findOneByOrFail.mockResolvedValueOnce({
      id: 'server-1',
      ownerId: 'owner-1',
    });
    memberRepository.findOneOrFail.mockResolvedValueOnce({
      roles: [
        {
          id: 'role-everyone',
          isEveryone: true,
          position: 0,
          permissions: (
            Permission.ViewChannel | Permission.SendMessages
          ).toString(),
        },
      ],
    });
    channelOverwritesRepository.find.mockResolvedValueOnce([
      {
        targetId: 'member-1',
        targetType: 'user',
        allow: '0',
        deny: Permission.SendMessages.toString(),
      },
    ]);

    const result = await service.resolveForChannel(
      'member-1',
      'server-1',
      'channel-1',
    );

    expect(result.has(Permission.ViewChannel)).toBe(true);
    expect(result.has(Permission.SendMessages)).toBe(false);
  });
});
