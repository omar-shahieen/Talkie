import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { ServiceUnavailableException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';

describe('AppController', () => {
  let moduleRef: TestingModule;
  let appController: AppController;
  let mockDataSource: { isInitialized: boolean; query: jest.Mock };
  let mockCache: { set: jest.Mock; get: jest.Mock };

  beforeEach(async () => {
    mockDataSource = {
      isInitialized: true,
      query: jest.fn().mockResolvedValue([{ '?column?': 1 }]),
    };
    mockCache = {
      set: jest.fn().mockResolvedValue(undefined),
      get: jest.fn().mockResolvedValue('pong'),
    };

    moduleRef = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        AppService,
        { provide: getDataSourceToken(), useValue: mockDataSource },
        { provide: CACHE_MANAGER, useValue: mockCache },
      ],
    }).compile();

    appController = moduleRef.get<AppController>(AppController);
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(appController.getHello()).toBe('Hello World!');
    });
  });

  describe('health & graceful shutdown hook', () => {
    it('should return ok when both postgres and redis are healthy', async () => {
      await expect(appController.health()).resolves.toEqual({
        status: 'ok',
        checks: { postgres: 'up', redis: 'up' },
      });
      expect(mockDataSource.query).toHaveBeenCalledWith('SELECT 1');
      expect(mockCache.set).toHaveBeenCalledWith('health:ping', 'pong', 5000);
      expect(mockCache.get).toHaveBeenCalledWith('health:ping');
    });

    it('should throw 503 degraded when postgres check fails', async () => {
      mockDataSource.query.mockRejectedValueOnce(
        new Error('DB connection lost'),
      );

      await expect(appController.health()).rejects.toThrow(
        ServiceUnavailableException,
      );
    });

    it('should throw 503 degraded when redis check fails', async () => {
      mockCache.get.mockResolvedValueOnce(null);

      await expect(appController.health()).rejects.toThrow(
        ServiceUnavailableException,
      );
    });

    it('should throw 503 shutting_down after OnModuleDestroy runs', async () => {
      await moduleRef.close();

      await expect(appController.health()).rejects.toThrow(
        ServiceUnavailableException,
      );
    });
  });
});
