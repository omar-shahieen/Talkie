import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { CreateChannelDto } from './dto/create-channel.dto';
import { UpdateChannelDto } from './dto/update-channel.dto';
import { Channel, ChannelType } from './entities/channel.entity';
import { DataSource, In, Repository } from 'typeorm';
import { Permission } from '../access-control/server-permissions/serverPermissions.constants';
import { ChannelMember } from './entities/channel-member.entity';
import { ReadState } from './entities/readState.entity';
import { ServerPermissionsService } from 'src/access-control/server-permissions/serverPermissions.service';

@Injectable()
export class ChannelsService {
  constructor(
    @InjectRepository(Channel)
    private readonly channelsRepository: Repository<Channel>,
    @InjectRepository(ReadState)
    private readonly readStatesRepository: Repository<ReadState>,
    private readonly permissionsService: ServerPermissionsService,
    private readonly dataSource: DataSource,
  ) {}

  async create(createChannelDto: CreateChannelDto): Promise<Channel> {
    const channel = this.channelsRepository.create(createChannelDto);
    return this.channelsRepository.save(channel);
  }

  async findAll(): Promise<Channel[]> {
    return this.channelsRepository.find();
  }

  async findOne(id: string): Promise<Channel> {
    const channel = await this.channelsRepository.findOneBy({ id });
    if (!channel) {
      throw new NotFoundException('Channel not found');
    }
    return channel;
  }

  async update(
    id: string,
    updateChannelDto: UpdateChannelDto,
  ): Promise<Channel> {
    const channel = await this.findOne(id);
    Object.assign(channel, updateChannelDto);
    return this.channelsRepository.save(channel);
  }

  async remove(id: string): Promise<void> {
    const channel = await this.findOne(id);
    await this.channelsRepository.remove(channel);
  }

  async getOrCreatDmChannel(
    userOneId: string,
    userTwoId: string,
  ): Promise<Channel> {
    // try to find  a dm message where  both are memebers
    const existingChannel = await this.channelsRepository
      .createQueryBuilder('channel')
      // Join the "dmMembers" array from your Channel entity for User One
      .innerJoin(
        'channel.dmMembers',
        'member1',
        'member1.userId = :userOneId',
        { userOneId },
      )
      // Join the same "dmMembers" array again for User Two
      .innerJoin(
        'channel.dmMembers',
        'member2',
        'member2.userId = :userTwoId',
        { userTwoId },
      )
      // Make sure we are only looking for DMs
      .where('channel.type = :type', { type: ChannelType.DM })
      .getOne();

    if (existingChannel) {
      return existingChannel;
    }
    // otherwise createa a new base DM channel

    return this.dataSource.transaction(async (manager) => {
      // create new channel
      const newChannel = manager.create(Channel, {
        type: ChannelType.DM,
        serverId: undefined,
        name: undefined,
      });
      const savedChannel = await manager.save(Channel, newChannel);

      // create and save both members

      const member1 = manager.create(ChannelMember, {
        channelId: savedChannel.id,
        userId: userOneId,
      });
      const member2 = manager.create(ChannelMember, {
        channelId: savedChannel.id,
        userId: userTwoId,
      });

      await manager.save(ChannelMember, [member1, member2]);

      return savedChannel;
    });
  }

  async ackChannel(channelId: string, userId: string, messageId: string) {
    let readState = await this.readStatesRepository.findOne({
      where: { channelId, userId },
    });

    if (!readState) {
      readState = this.readStatesRepository.create({
        channelId,
        userId,
      });
    }
    readState.lastReadMessageId = messageId;
    readState.lastReadAt = new Date();

    return this.readStatesRepository.save(readState);
  }

  async findVisibleByServer(serverId: string, userId: string) {
    const channels = await this.channelsRepository.findBy({ serverId });

    // Pre-fetch all read states for this user in this server to avoid N+1 queries
    const channelIds = channels.map((c) => c.id);
    const readStates = await this.readStatesRepository.find({
      where: { userId, channelId: In(channelIds) },
    });
    const readStateMap = new Map(readStates.map((rs) => [rs.channelId, rs]));

    const visibilityAndUnread = await Promise.all(
      channels.map(async (channel) => {
        try {
          const permissions = await this.permissionsService.resolveForChannel(
            userId,
            serverId,
            channel.id,
          );

          const isVisible = permissions.has(Permission.ViewChannel);
          if (!isVisible) return { channel, visible: false };

          // 1. Get user's read state for this channel from our pre-fetched map
          const readState = readStateMap.get(channel.id);

          // 2. Determine unread status using the channel's lastMessageId
          // If there is a last message, AND (they have no read state OR their read state doesn't match the last message)
          // Note: This relies on string comparison of IDs, or assuming if they aren't equal, it's unread.
          // For exact chronological comparisons you might still need the message dates, but ID equality is a fast heuristic.
          const hasUnread =
            channel.lastMessageId !== null &&
            (!readState ||
              readState.lastReadMessageId !== channel.lastMessageId);

          // Return the channel with the computed unread property
          return { channel: { ...channel, hasUnread }, visible: true };
        } catch {
          return { channel, visible: false };
        }
      }),
    );

    return visibilityAndUnread
      .filter((entry) => entry.visible)
      .map((entry) => entry.channel);
  }

  async isDmMember(channelId: string, userId: string) {
    const channel = await this.channelsRepository.findOne({
      where: {
        id: channelId,
        dmMembers: { userId },
      },
      select: ['id'],
    });

    return channel && channel.type === ChannelType.DM ? true : false;
  }
  async isServerMember(channelId: string, userId: string) {
    const channel = await this.channelsRepository.findOne({
      where: {
        id: channelId,
      },
      relations: ['dmMembers'],
    });

    if (!channel || channel.type === ChannelType.DM || !channel.serverId)
      return false;

    try {
      // For Server channels: Evaluate their permission to view the channel
      const permissions = await this.permissionsService.resolveForChannel(
        userId,
        channel.serverId,
        channel.id,
      );
      return permissions.has(Permission.ViewChannel);
    } catch {
      return false;
    }
  }
}
