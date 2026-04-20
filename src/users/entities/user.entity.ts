import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import * as bcrypt from 'bcrypt';
import { Exclude } from 'class-transformer';
import {
  IsEmail,
  IsString,
  IsBoolean,
  IsOptional,
  MinLength,
  MaxLength,
  Matches,
} from 'class-validator';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @IsString()
  @IsOptional()
  @MaxLength(50)
  @Column({ nullable: true })
  firstName?: string;

  @IsString()
  @IsOptional()
  @MaxLength(50)
  @Column({ nullable: true })
  lastName?: string;

  @IsEmail()
  @MaxLength(255)
  @Column({ unique: true })
  email!: string;

  @IsString()
  @MinLength(3)
  @MaxLength(32)
  @Matches(/^[a-zA-Z0-9_.-]+$/, {
    message:
      'Username can only contain letters, numbers, underscores, dots, and hyphens',
  })
  @Column({ unique: true })
  username!: string;

  @Exclude() // never serialized in responses
  @IsOptional()
  @IsString()
  @MinLength(8)
  @MaxLength(72) // bcrypt silently truncates beyond 72 bytes
  @Column({ nullable: true, select: false }) // never returned in queries by default
  password?: string;

  @Exclude()
  @IsOptional()
  @IsString()
  @Column({ nullable: true, select: false, unique: true })
  googleId?: string;

  @Exclude()
  @IsOptional()
  @IsString()
  @Column({ nullable: true, select: false, unique: true })
  currentJwtToken?: string;

  @IsBoolean()
  @Column({ default: true })
  isActive!: boolean;

  @IsBoolean()
  @Column({ default: false })
  isTfaEnabled!: boolean;

  @Exclude()
  @IsOptional()
  @IsString()
  @Column({ nullable: true, select: false })
  tfaSecret?: string;

  @Column({ type: 'enum', enum: ['online', 'dnd'], nullable: true })
  status_preference?: 'online' | 'dnd' | null;

  @Column({ type: 'timestamp', nullable: true })
  dnd_until?: Date | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  async comparePassword(plain: string): Promise<boolean> {
    if (!this.password) return false;
    return bcrypt.compare(plain, this.password);
  }
  async compareToken(token: string): Promise<boolean> {
    if (!this.currentJwtToken) return false;
    return bcrypt.compare(token, this.currentJwtToken);
  }
}
