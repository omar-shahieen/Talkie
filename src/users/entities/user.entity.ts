import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { Exclude } from 'class-transformer';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ nullable: true })
  firstName!: string;

  @Column({ nullable: true })
  lastName!: string;

  @Column({ unique: true })
  email!: string;

  @Column({ unique: true })
  username!: string;

  @Column({ nullable: true })
  password!: string;

  @Column({ nullable: true })
  googleId!: string;

  @Column({ nullable: true })
  currentJwtToken!: string;

  @Column({ default: true })
  isActive!: boolean;

  @Column({ default: false })
  isTfaEnabled: boolean;

  @Column({ nullable: true })
  // NOTE: add Exclude decorator, to don't return this value inside Users in responses
  @Exclude()
  tfaSecret: string;
  async comparePassword(plain: string): Promise<boolean> {
    if (!this.password) {
      return false;
    }

    return bcrypt.compare(plain, this.password);
  }
}
