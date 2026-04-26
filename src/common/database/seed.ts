import { DataSource } from 'typeorm';
import { faker } from '@faker-js/faker';

import { User } from '../../users/entities/user.entity';
import { Server } from '../../servers/entities/server.entity';
import { Role } from '../../roles/entities/role.entity';
import { ServerMember } from '../../users/entities/server-member.entity';
import { Channel, ChannelType } from '../../channels/entities/channel.entity';
import { ChannelMember } from '../../channels/entities/channel-member.entity';
import { ChannelOverwrite } from '../../channels/entities/channel-overwrite.entity';
import { ReadState } from '../../channels/entities/readState.entity';
import { Message } from '../../messages/entities/message.entity';
import {
  Notification,
  NotificationType,
} from '../../notifications/entities/notification.entity';
import { UserSubscriber } from '../../users/user.subscriber';

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
    ChannelMember,
    ChannelOverwrite,
    ReadState,
    Message,
    Notification,
  ],
  subscribers: [UserSubscriber], // 👈 this is what was missing
  synchronize: true,
  dropSchema: true,
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
  const channelMemberRepo = AppDataSource.getRepository(ChannelMember);
  const overwriteRepo = AppDataSource.getRepository(ChannelOverwrite);
  const readStateRepo = AppDataSource.getRepository(ReadState);
  const messageRepo = AppDataSource.getRepository(Message);
  const notificationRepo = AppDataSource.getRepository(Notification);

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
        password: 'password123',
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
      inviteCode: faker.string.alphanumeric(8),
      description: faker.lorem.sentence(),
      category: faker.helpers.arrayElement([
        'gaming',
        'study',
        'music',
        'tech',
      ]),
      tags: faker.helpers.arrayElements(
        ['pvp', 'co-op', 'chill', 'competitive', 'casual'],
        2,
      ),
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
    channelRepo.create({
      name: 'general',
      serverId: server.id,
      type: ChannelType.SERVER_TEXT,
    }),
    channelRepo.create({
      name: 'admin-secret',
      serverId: server.id,
      type: ChannelType.SERVER_TEXT,
    }),
  ]);

  const dmUsers = [users[1], users[2]];
  const dmChannel = await channelRepo.save(
    channelRepo.create({ type: ChannelType.DM }),
  );

  await channelMemberRepo.save(
    dmUsers.map((user) =>
      channelMemberRepo.create({
        channelId: dmChannel.id,
        userId: String(user.id),
      }),
    ),
  );

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
  const generalMessages = await messageRepo.save(
    Array.from({ length: 20 }, () => {
      const randomUser = users[Math.floor(Math.random() * users.length)];
      return messageRepo.create({
        content: faker.lorem.sentence(),
        authorId: String(randomUser.id),
        channelId: generalChannel.id,
      });
    }),
  );

  const dmMessages = await messageRepo.save(
    Array.from({ length: 8 }, () => {
      const randomUser = dmUsers[Math.floor(Math.random() * dmUsers.length)];
      return messageRepo.create({
        content: faker.lorem.sentence(),
        authorId: String(randomUser.id),
        channelId: dmChannel.id,
      });
    }),
  );

  await channelRepo.save([
    channelRepo.create({
      id: generalChannel.id,
      lastMessageId: generalMessages.at(-1)?.id ?? null,
    }),
    channelRepo.create({
      id: dmChannel.id,
      lastMessageId: dmMessages.at(-1)?.id ?? null,
    }),
  ]);

  // ---------------------------------------------------
  // 8. Read States
  // ---------------------------------------------------
  console.log('👀 Seeding Read States...');
  await readStateRepo.save(
    users.map((user) =>
      readStateRepo.create({
        userId: String(user.id),
        channelId: generalChannel.id,
        lastReadMessageId: generalMessages.at(-1)?.id ?? undefined,
      }),
    ),
  );

  await readStateRepo.save(
    dmUsers.map((user) =>
      readStateRepo.create({
        userId: String(user.id),
        channelId: dmChannel.id,
        lastReadMessageId: dmMessages.at(-1)?.id ?? undefined,
      }),
    ),
  );

  // ---------------------------------------------------
  // 9. Notifications
  // ---------------------------------------------------
  console.log('🔔 Seeding Notifications...');
  await notificationRepo.save([
    notificationRepo.create({
      recipientId: String(users[3].id),
      senderId: String(users[0].id),
      serverId: server.id,
      channelId: generalChannel.id,
      content: 'You were mentioned in #general',
      link: `/channels/${server.id}/${generalChannel.id}`,
      type: NotificationType.MENTION,
      isRead: false,
    }),
    notificationRepo.create({
      recipientId: String(users[4].id),
      senderId: String(users[1].id),
      content: 'New message request',
      link: `/channels/@me/${dmChannel.id}`,
      type: NotificationType.DM,
      isRead: true,
    }),
  ]);

  console.log('✅ Database seeded successfully!');
  await AppDataSource.destroy();
}

seed().catch((err) => {
  console.error('❌ Seeding failed!', err);
  process.exit(1);
});
