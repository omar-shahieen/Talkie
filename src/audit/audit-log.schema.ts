import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type AuditLogDocument = HydratedDocument<AuditLog>;

@Schema({ timestamps: true }) // adds createdAt / updatedAt automatically
export class AuditLog {
  @Prop({ required: true, index: true })
  action: string;

  @Prop({ type: Object })
  payload: Record<string, unknown>;
}

export const AuditLogSchema = SchemaFactory.createForClass(AuditLog);
