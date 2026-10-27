import {
  Controller,
  Get,
  OnModuleDestroy,
  Post,
  ServiceUnavailableException,
} from '@nestjs/common';
import { AppService } from './app.service';
import { Public } from './auth/decorators/public.decorator';

@Controller()
export class AppController implements OnModuleDestroy {
  private shuttingDown = false;

  constructor(private readonly appService: AppService) {}

  // First shutdown phase (before the HTTP server closes): flip readiness to 503.
  onModuleDestroy() {
    this.shuttingDown = true;
  }

  @Get()
  @Public()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('health')
  @Public()
  health(): { status: string } {
    // Readiness: report 503 while draining so load balancers stop routing here.
    if (this.shuttingDown) {
      throw new ServiceUnavailableException('shutting_down');
    }
    return { status: 'ok' };
  }

  @Get('test-slow')
  @Public()
  async testSlow(): Promise<{ ok: boolean; duration: number }> {
    await new Promise((resolve) => setTimeout(resolve, 2000));
    return { ok: true, duration: 2000 };
  }

  @Post('test-shutdown')
  @Public()
  testShutdown(): { status: string; message: string } {
    setTimeout(() => {
      process.emit('SIGTERM');
    }, 100);
    return {
      status: 'shutting_down',
      message: 'Graceful shutdown initiated',
    };
  }
}
