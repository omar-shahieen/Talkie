import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { CreateChannelDto } from './dto/create-channel.dto';
import { UpdateChannelDto } from './dto/update-channel.dto';
import { Channel, ChannelType } from './entities/channel.entity';
import { DataSource, Repository } from 'typeorm';
import { PermissionsService } from '../access-control/rbac/permissions.service';
import { Permission } from '../access-control/rbac/permissions.constants';
import { ChannelMember } from './entities/channel-member.entity';

@Injectable()
export class ChannelsService {
  constructor(
    @InjectRepository(Channel)
    private readonly channelsRepository: Repository<Channel>,
    @InjectRepository(ChannelMember)
    private readonly channelMemberssRepository: Repository<ChannelMember>,
    private readonly permissionsService: PermissionsService,
    private readonly dataSource: DataSource,
  ) {}

  async create(createChannelDto: CreateChannelDto): Promise<Channel> {
    const channel = this.channelsRepository.create(createChannelDto);
    return this.channelsRepository.save(channel);
  }

  async findAll(): Promise<Channel[]> {
    return this.channelsRepository.find();
  }

  async findVisibleByServer(
    serverId: string,
    userId: string,
  ): Promise<Channel[]> {
    const channels = await this.channelsRepository.findBy({ serverId });

    const visibility = await Promise.all(
      channels.map(async (channel) => {
        try {
          const permissions = await this.permissionsService.resolveForChannel(
            userId,
            serverId,
            channel.id,
          );

          return {
            channel,
            visible: permissions.has(Permission.ViewChannel),
          };
        } catch {
          return { channel, visible: false };
        }
      }),
    );

    return visibility
      .filter((entry) => entry.visible)
      .map((entry) => entry.channel);
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
}
