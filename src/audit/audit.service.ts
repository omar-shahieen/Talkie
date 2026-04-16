import { Injectable } from '@nestjs/common';
import { AppEvents } from '../common/events/events.enum';
import { InjectModel } from '@nestjs/mongoose';
import { AuditLog, AuditLogDocument } from './audit-log.schema';
import { Model } from 'mongoose';

@Injectable()
export class AuditService {
  constructor(
    @InjectModel(AuditLog.name)
    private readonly auditLogModel: Model<AuditLogDocument>,
  ) {}

  async create(action: AppEvents, payload: Record<string, unknown>) {
    return this.auditLogModel.create({ action, payload });
  }

  async getLogs({ action, limit = 50 }: { action?: string; limit?: number }) {
    const filter = action ? { action } : {};
    return this.auditLogModel
      .find(filter)
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();
  }
}
