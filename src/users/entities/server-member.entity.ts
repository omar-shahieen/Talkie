import {
  Entity,
  JoinTable,
  ManyToMany,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import { Server } from '../../servers/entities/server.entity';
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
    joinColumn: { name: 'memberId', referencedColumnName: 'memberId' },
    inverseJoinColumn: { name: 'roleId', referencedColumnName: 'id' },
  })
  roles!: Role[];
}
