import {
  Entity,
  JoinTable,
  ManyToMany,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import { Server } from './server.entity';
import { Role } from '../../roles/entities/role.entity';

@Entity('server_members')
export class ServerMember {
  @PrimaryColumn()
  memberId!: string;

  @PrimaryColumn()
  serverId!: string;

  @ManyToOne(() => Server, (server) => server.members)
  server!: Server;

  @ManyToMany(() => Role)
  @JoinTable({
    name: 'member_roles',
    joinColumns: [
      { name: 'memberId', referencedColumnName: 'memberId' },
      { name: 'serverId', referencedColumnName: 'serverId' },
    ],
    inverseJoinColumns: [{ name: 'roleId', referencedColumnName: 'id' }],
  })
  roles!: Role[];
}
