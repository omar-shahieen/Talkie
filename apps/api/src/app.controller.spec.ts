import { ServiceUnavailableException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';

describe('AppController', () => {
  let moduleRef: TestingModule;
  let appController: AppController;

  beforeEach(async () => {
    moduleRef = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService],
    }).compile();

    appController = moduleRef.get<AppController>(AppController);
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(appController.getHello()).toBe('Hello World!');
    });
  });

  describe('health & graceful shutdown hook', () => {
    it('should return ok when healthy and throw 503 after OnModuleDestroy runs', async () => {
      expect(appController.health()).toEqual({ status: 'ok' });

      await moduleRef.close();

      expect(() => appController.health()).toThrow(ServiceUnavailableException);
    });
  });
});
