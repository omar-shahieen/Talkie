import { DataSource } from 'typeorm';
import { faker } from '@faker-js/faker';

import { User } from '../users/entities/user.entity';
import { Server } from '../servers/entities/server.entity';
import { Role } from '../roles/entities/role.entity';
import { ServerMember } from '../users/entities/server-member.entity';
import { Channel } from '../channels/entities/channel.entity';
import { ChannelOverwrite } from '../channels/entities/channel-overwrite.entity';
import { Message } from '../messages/entities/message.entity';

// ---------------------------------------------------
// Standalone DataSource — no NestJS/AppModule needed
// ---------------------------------------------------
const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST ?? 'localhost',
  port: Number(process.env.DB_PORT ?? 5432),
  username: process.env.DB_USER ?? 'postgres',
  password: process.env.DB_PASS ?? 'postgres',
  database: process.env.DB_NAME ?? 'discord',
  entities: [
    User,
    Server,
    Role,
    ServerMember,
    Channel,
    ChannelOverwrite,
    Message,
  ],
  synchronize: true, // Never true in production
  dropSchema: true, // CAUTION: This drops the schema every time the connection is established
  logging: false,
});

async function seed() {
  console.log('🌱 Starting database seeder...');
  await AppDataSource.initialize();
  console.log('🔌 Connected to database.');

  const userRepo = AppDataSource.getRepository(User);
  const serverRepo = AppDataSource.getRepository(Server);
  const roleRepo = AppDataSource.getRepository(Role);
  const memberRepo = AppDataSource.getRepository(ServerMember);
  const channelRepo = AppDataSource.getRepository(Channel);
  const overwriteRepo = AppDataSource.getRepository(ChannelOverwrite);
  const messageRepo = AppDataSource.getRepository(Message);

  // ---------------------------------------------------
  // 1. Users
  // ---------------------------------------------------
  console.log('👤 Seeding Users...');
  const users = await userRepo.save(
    Array.from({ length: 10 }, () =>
      userRepo.create({
        firstName: faker.person.firstName(),
        lastName: faker.person.lastName(),
        email: faker.internet.email(),
        username: faker.internet.username(),
        password: faker.internet.password(),
        isActive: true,
      }),
    ),
  );
  const owner = users[0];

  // ---------------------------------------------------
  // 2. Server
  // ---------------------------------------------------
  console.log('🖥️  Seeding Server...');
  const server = await serverRepo.save(
    serverRepo.create({
      name: `${owner.username}'s Gaming Hub`,
      ownerId: String(owner.id),
    }),
  );

  // ---------------------------------------------------
  // 3. Roles
  // ---------------------------------------------------
  console.log('🛡️  Seeding Roles...');
  const [everyoneRole, adminRole] = await roleRepo.save([
    roleRepo.create({
      name: '@everyone',
      position: 0,
      permissions: '104320577',
      isEveryone: true,
      serverId: server.id,
    }),
    roleRepo.create({
      name: 'Admin',
      position: 1,
      permissions: '8',
      isEveryone: false,
      serverId: server.id,
    }),
  ]);

  // ---------------------------------------------------
  // 4. Server Members (two-phase to avoid FK race)
  // ---------------------------------------------------
  console.log('👥 Seeding Server Members...');
  const members = await memberRepo.save(
    users.map((user) =>
      memberRepo.create({
        serverId: server.id,
        userId: String(user.id),
      }),
    ),
  );

  for (let i = 0; i < members.length; i++) {
    members[i].roles = i === 0 ? [everyoneRole, adminRole] : [everyoneRole];
  }
  await memberRepo.save(members);

  // ---------------------------------------------------
  // 5. Channels
  // ---------------------------------------------------
  console.log('💬 Seeding Channels...');
  const [generalChannel, adminChannel] = await channelRepo.save([
    channelRepo.create({ name: 'general', serverId: server.id }),
    channelRepo.create({ name: 'admin-secret', serverId: server.id }),
  ]);

  // ---------------------------------------------------
  // 6. Channel Overwrites
  // ---------------------------------------------------
  console.log('🔒 Seeding Channel Overwrites...');
  await overwriteRepo.save([
    overwriteRepo.create({
      channelId: adminChannel.id,
      targetId: everyoneRole.id,
      targetType: 'role',
      deny: '1024',
      allow: '0',
    }),
    overwriteRepo.create({
      channelId: adminChannel.id,
      targetId: adminRole.id,
      targetType: 'role',
      deny: '0',
      allow: '1024',
    }),
  ]);

  // ---------------------------------------------------
  // 7. Messages
  // ---------------------------------------------------
  console.log('📝 Seeding Messages...');
  await messageRepo.save(
    Array.from({ length: 20 }, () => {
      const randomUser = users[Math.floor(Math.random() * users.length)];
      return messageRepo.create({
        content: faker.lorem.sentence(),
        authorId: String(randomUser.id),
        channelId: generalChannel.id,
      });
    }),
  );

  console.log('✅ Database seeded successfully!');
  await AppDataSource.destroy();
}

seed().catch((err) => {
  console.error('❌ Seeding failed!', err);
  process.exit(1);
});
