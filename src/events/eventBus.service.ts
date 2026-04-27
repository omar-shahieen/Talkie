import { EventEmitter2 } from '@nestjs/event-emitter';
import { Injectable } from '@nestjs/common';

@Injectable()
export class EventBusService {
  constructor(private readonly emitter: EventEmitter2) {}

  emit(event: string, payload: Record<string, unknown>): void {
    this.emitter.emit(event, { event, ...payload });
  }
  //for async workflows — waits for all handlers to resolve
  async emitAsync(
    event: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    await this.emitter.emitAsync(event, { event, ...payload });
  }
}
