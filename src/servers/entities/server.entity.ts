import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { Role } from '../../roles/entities/role.entity';
import { Channel } from '../../channels/entities/channel.entity';
import { ServerMember } from '../../users/entities/server-member.entity';

@Entity('servers')
export class Server {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  name!: string;

  @Column()
  ownerId!: string;

  @Column({ default: false })
  isPublic!: boolean;

  @Column({ nullable: true })
  description?: string;

  @Column({ nullable: true })
  category?: string;

  @Column('simple-array', { nullable: true })
  tags?: string[];

  // Assigns a random UUID for any existing rows in the DB so migration doesn't crash
  @Column({ unique: true })
  inviteCode?: string;

  @OneToMany(() => Role, (role) => role.server)
  roles!: Role[];

  @OneToMany(() => Channel, (channel) => channel.server)
  channels!: Channel[];

  @OneToMany(() => ServerMember, (member) => member.server)
  members!: ServerMember[];
}
