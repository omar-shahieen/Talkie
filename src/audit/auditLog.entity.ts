import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('auditLog')
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  action!: string;

  @Column({ type: 'jsonb' })
  payload!: Record<string, unknown>;
}
