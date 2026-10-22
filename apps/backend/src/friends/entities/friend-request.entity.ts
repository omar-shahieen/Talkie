import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

export type FriendRequestStatus =
  | 'pending'
  | 'accepted'
  | 'rejected'
  | 'cancelled';

@Entity('friend_requests')
@Index(['senderId', 'receiverId'], { unique: true })
export class FriendRequest {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'sender_id' })
  senderId!: string;

  @Column({ name: 'receiver_id' })
  receiverId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE', lazy: true })
  @JoinColumn({ name: 'sender_id' })
  sender!: User;

  @ManyToOne(() => User, { onDelete: 'CASCADE', lazy: true })
  @JoinColumn({ name: 'receiver_id' })
  receiver!: User;

  @Column({ type: 'varchar', default: 'pending' })
  status!: FriendRequestStatus;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
