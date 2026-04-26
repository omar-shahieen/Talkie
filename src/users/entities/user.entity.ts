import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
} from 'typeorm';
import * as bcrypt from 'bcrypt';

export enum AppRole {
  USER = 'user',
  ADMIN = 'admin',
}
@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ nullable: true })
  firstName?: string;

  @Column({ nullable: true })
  lastName?: string;

  @Column({ unique: true })
  email!: string;

  @Column({ unique: true })
  username!: string;

  @Column({ nullable: true, select: false }) // never returned in queries by default
  password?: string;

  @Column({ nullable: true, select: false, unique: true })
  googleId?: string;

  @Column({ nullable: true, select: false, unique: true })
  currentJwtToken?: string;

  @Column({ default: false })
  isTfaEnabled!: boolean;

  @Column({ nullable: true, select: false })
  tfaSecret?: string;

  @Column({ type: 'enum', enum: ['online', 'dnd'], nullable: true })
  status_preference?: 'online' | 'dnd' | null;

  @Column({ type: 'timestamp', nullable: true })
  dnd_until?: Date | null;

  @Column({ type: 'enum', enum: AppRole, default: AppRole.USER, select: false })
  appRole!: AppRole;
  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @DeleteDateColumn()
  deletedAt!: Date; // This will store the deletion timestamp

  async comparePassword(plain: string): Promise<boolean> {
    if (!this.password) return false;
    return bcrypt.compare(plain, this.password);
  }
  async compareToken(token: string): Promise<boolean> {
    if (!this.currentJwtToken) return false;
    return bcrypt.compare(token, this.currentJwtToken);
  }
}
