import { Module } from '@nestjs/common';
import { RealtimeGateway } from './realtime.gateway';
import { RealtimeAuthGuard } from './realtime-auth.guard';
import { AccessControlModule } from '../access-control/access-control.module';

@Module({
  imports: [AccessControlModule],
  providers: [RealtimeGateway, RealtimeAuthGuard],
  exports: [RealtimeGateway],
})
export class RealtimeModule {}