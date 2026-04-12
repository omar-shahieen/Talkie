import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { Role } from '../../roles/entities/role.entity';
import { Channel } from '../../channels/entities/channel.entity';
import { ServerMember } from '../../users/entities/server-members.entity';

@Entity('servers')
export class Server {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column()
  ownerId: string;

  @OneToMany(() => Role, (role) => role.server)
  roles: Role[];

  @OneToMany(() => Channel, (channel) => channel.server)
  channels: Channel[];

  @OneToMany(() => ServerMember, (member) => member.server)
  members: ServerMember[];
}
