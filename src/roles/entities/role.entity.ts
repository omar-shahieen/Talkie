import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Server } from '../../servers/entities/server.entity';

@Entity('roles')
export class Role {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ type: 'int', default: 0 })
  position: number;

  @Column({ type: 'varchar', length: 20, default: '0' })
  permissions: string; // The base bitfield

  @Column({ default: false })
  isEveryone: boolean;

  @Column()
  serverId: string;

  @ManyToOne(() => Server, (server) => server.roles)
  server: Server;
}
