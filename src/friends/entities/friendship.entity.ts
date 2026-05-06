import {
  Entity,
  PrimaryColumn,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

@Entity('friendships')
export class Friendship {
  @PrimaryColumn({ name: 'user_id_1' })
  userId1!: string;

  @PrimaryColumn({ name: 'user_id_2' })
  userId2!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE', lazy: true })
  @JoinColumn({ name: 'user_id_1' })
  user1!: User;

  @ManyToOne(() => User, { onDelete: 'CASCADE', lazy: true })
  @JoinColumn({ name: 'user_id_2' })
  user2!: User;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
