import { Test, TestingModule } from '@nestjs/testing';
import { AccessControlController } from './access-control.controller';
import { PermissionsService } from './rbac/permissions.service';

describe('AccessControlController', () => {
  let controller: AccessControlController;

  const mockPermissionsService = {
    resolveForChannel: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AccessControlController],
      providers: [
        {
          provide: PermissionsService,
          useValue: mockPermissionsService,
        },
      ],
    }).compile();

    controller = module.get<AccessControlController>(AccessControlController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('delegates resolve to permissions service', async () => {
    mockPermissionsService.resolveForChannel.mockResolvedValueOnce({
      toJSON: () => '1024',
    });

    await controller.resolve('user-1', 'server-1', 'channel-1');

    expect(mockPermissionsService.resolveForChannel).toHaveBeenCalledWith(
      'user-1',
      'server-1',
      'channel-1',
    );
  });
});
