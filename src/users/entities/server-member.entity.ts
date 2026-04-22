import {
  Column,
  Entity,
  JoinTable,
  ManyToMany,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Server } from '../../servers/entities/server.entity';
import { Role } from '../../roles/entities/role.entity';

@Entity('server_members')
export class ServerMember {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  serverId!: string;

  @Column({ type: 'uuid' })
  userId!: string;

  @ManyToOne(() => Server, (server) => server.members)
  server!: Server;

  @ManyToMany(() => Role)
  @JoinTable({
    name: 'member_roles',
    joinColumn: { name: 'memberId', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'roleId', referencedColumnName: 'id' },
  })
  roles!: Role[];
}
