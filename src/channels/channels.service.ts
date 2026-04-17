import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { CreateChannelDto } from './dto/create-channel.dto';
import { UpdateChannelDto } from './dto/update-channel.dto';
import { Channel } from './entities/channel.entity';
import { Repository } from 'typeorm';
import { PermissionsService } from '../access-control/rbac/permissions.service';
import { Permission } from '../access-control/rbac/permissions.constants';

@Injectable()
export class ChannelsService {
  constructor(
    @InjectRepository(Channel)
    private readonly channelsRepository: Repository<Channel>,
    private readonly permissionsService: PermissionsService,
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

    return visibility.filter((entry) => entry.visible).map((entry) => entry.channel);
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
}
