import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Server } from './server.entity';
import { ServerMember } from '../../users/entities/server-member.entity';

@Entity('invitations')
export class Invitation {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ unique: true })
  inviteCode!: string;

  @Column()
  serverId!: string;

  @Column()
  inviterId!: string;

  @Column({ type: 'int', default: 0 })
  currentUses!: number;

  @Column({ type: 'int', nullable: true, default: null })
  maxUses?: number | null;

  @Column({ type: 'timestamp', nullable: true, default: null })
  expiresAt?: Date | null;

  @CreateDateColumn()
  createdAt!: Date;

  @DeleteDateColumn()
  deletedAt!: Date | null; // This will store the deletion timestamp

  @ManyToOne(() => Server, (server) => server.invitations)
  server!: Server;

  @ManyToOne(() => ServerMember)
  @JoinColumn({ name: 'inviterId', referencedColumnName: 'memberId' })
  inviter!: ServerMember;
}
