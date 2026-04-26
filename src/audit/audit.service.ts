import { Injectable } from '@nestjs/common';
import { AppEvents } from '../events/events.enum';
import { AuditLog } from './audit-log.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

@Injectable()
export class AuditService {
  constructor(
    @InjectRepository(AuditLog)
    private readonly auditLogsRepository: Repository<AuditLog>,
  ) {}

  async create(action: AppEvents, payload: Record<string, unknown>) {
    const log = this.auditLogsRepository.create({ action, payload });
    await this.auditLogsRepository.save(log);
    return log;
  }

  // async getLogs({ action, limit = 50 }: { action?: string; limit?: number }) {
  //   const filter = action ? { action } : {};
  //   return this.auditLogsRepository
  //     .find({
  //       where: { filter },
  //     })
  //     .sort({ createdAt: -1 })
  //     .limit(limit)
  //     .lean();
  // }
}
