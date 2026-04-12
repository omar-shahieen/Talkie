import { Inject, Injectable } from '@nestjs/common';
import { CACHE_MANAGER, Cache } from '@nestjs/cache-manager';

@Injectable()
export class AppService {
  getHello(): string {
    return 'Hello World!';
  }
}
