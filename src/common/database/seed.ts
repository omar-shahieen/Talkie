import 'reflect-metadata';

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { faker } from '@faker-js/faker';
import { DataSource } from 'typeorm';

import { Channel, ChannelType } from '../../channels/entities/channel.entity';
import { ChannelMember } from '../../channels/entities/channel-member.entity';
import { ChannelOverwrite } from '../../channels/entities/channel-overwrite.entity';
import { ReadState } from '../../channels/entities/readState.entity';
import { Invitation } from '../../invitations/entities/invitation.entity';
import { Message } from '../../messages/entities/message.entity';
import {
  Notification,
  NotificationType,
} from '../../notifications/entities/notification.entity';
import { Role } from '../../roles/entities/role.entity';
import { Server } from '../../servers/entities/server.entity';
import { ServerMember } from '../../servers/entities/server-member.entity';
import { UserSubscriber } from '../../users/user.subscriber';
import { User } from '../../users/entities/user.entity';

const loadEnvFile = (filePath: string): void => {
  if (!existsSync(filePath)) {
    return;
  }

  const contents = readFileSync(filePath, 'utf8');
  for (const line of contents.split(/\r?\n/)) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const equalsIndex = trimmed.indexOf('=');
    if (equalsIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, equalsIndex).trim();
    const rawValue = trimmed.slice(equalsIndex + 1).trim();
    const value = rawValue.replace(/^['\\"]|['\\"]$/g, '');

    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
};

loadEnvFile(resolve(process.cwd(), '.env'));
loadEnvFile(resolve(process.cwd(), '.env.example'));

const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST ?? 'localhost',
  port: Number(process.env.DB_PORT ?? 5432),
  username: process.env.DB_USERNAME ?? 'postgres',
  password: process.env.DB_PASSWORD ?? 'postgres',
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
    Invitation,
    Notification,
  ],
  subscribers: [UserSubscriber],
  synchronize: true,
  dropSchema: true,
  logging: false,
});

const pick = <T>(items: T[]): T =>
  items[Math.floor(Math.random() * items.length)];

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
  const invitationRepo = AppDataSource.getRepository(Invitation);
  const notificationRepo = AppDataSource.getRepository(Notification);

  console.log('👤 Seeding users...');
  const users = await userRepo.save(
    Array.from({ length: 10 }, (_, index) => {
      const firstName = faker.person.firstName();
      const lastName = faker.person.lastName();

      return userRepo.create({
        firstName,
        lastName,
        email: `seed.user${index + 1}@example.com`,
        username: `seed_user_${index + 1}`,
        password: 'password123',
      });
    }),
  );

  const owner = users[0];

  console.log('🖥️  Seeding server...');
  const server = await serverRepo.save(
    serverRepo.create({
      name: `${owner.username}'s Gaming Hub`,
      ownerId: owner.id,
      isPublic: true,
      icon: '',
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

  console.log('🛡️  Seeding roles...');
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

  console.log('👥 Seeding server members...');
  const members = await memberRepo.save(
    users.map((user) =>
      memberRepo.create({
        serverId: server.id,
        memberId: user.id,
      }),
    ),
  );

  for (let index = 0; index < members.length; index += 1) {
    members[index].roles =
      index === 0 ? [everyoneRole, adminRole] : [everyoneRole];
  }
  await memberRepo.save(members);

  console.log('💬 Seeding channels...');
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
        userId: user.id,
      }),
    ),
  );

  console.log('🔒 Seeding channel overwrites...');
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

  console.log('📝 Seeding messages...');
  const generalMessages = await messageRepo.save(
    Array.from({ length: 20 }, () => {
      const randomUser = pick(users);

      return messageRepo.create({
        content: faker.lorem.sentence(),
        authorId: randomUser.id,
        channelId: generalChannel.id,
      });
    }),
  );

  const dmMessages = await messageRepo.save(
    Array.from({ length: 8 }, () => {
      const randomUser = pick(dmUsers);

      return messageRepo.create({
        content: faker.lorem.sentence(),
        authorId: randomUser.id,
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

  console.log('👀 Seeding read states...');
  await readStateRepo.save(
    users.map((user) =>
      readStateRepo.create({
        userId: user.id,
        channelId: generalChannel.id,
        lastReadMessageId: generalMessages.at(-1)!.id,
      }),
    ),
  );

  await readStateRepo.save(
    dmUsers.map((user) =>
      readStateRepo.create({
        userId: user.id,
        channelId: dmChannel.id,
        lastReadMessageId: dmMessages.at(-1)!.id,
      }),
    ),
  );

  console.log('🔗 Seeding invitations...');
  const invitation = await invitationRepo.save(
    invitationRepo.create({
      inviteCode: faker.string.alphanumeric(8),
      serverId: server.id,
      inviterId: owner.id,
      currentUses: 1,
      maxUses: 10,
      expiresAt: null,
    }),
  );

  console.log('🔔 Seeding notifications...');
  await notificationRepo.save([
    notificationRepo.create({
      recipientId: users[3].id,
      senderId: owner.id,
      serverId: server.id,
      channelId: generalChannel.id,
      content: 'You were mentioned in #general',
      link: `/channels/${server.id}/${generalChannel.id}`,
      type: NotificationType.MENTION,
      isRead: false,
    }),
    notificationRepo.create({
      recipientId: users[4].id,
      senderId: users[1].id,
      content: 'New message request',
      link: `/channels/@me/${dmChannel.id}`,
      type: NotificationType.DM,
      isRead: true,
    }),
    notificationRepo.create({
      recipientId: owner.id,
      senderId: users[2].id,
      serverId: server.id,
      content: `Invitation ${invitation.inviteCode} created`,
      link: `/invite/${invitation.inviteCode}`,
      type: NotificationType.OTHER,
      isRead: false,
    }),
  ]);

  console.log('✅ Database seeded successfully!');
}

seed()
  .catch((err) => {
    console.error('❌ Seeding failed!', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy();
    }
  });
