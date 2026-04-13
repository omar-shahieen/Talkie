import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { CreateServerDto } from './dto/create-server.dto';
import { UpdateServerDto } from './dto/update-server.dto';
import { Server } from './entities/server.entity';
import { Repository } from 'typeorm';

@Injectable()
export class ServersService {
  constructor(
    @InjectRepository(Server)
    private readonly serversRepository: Repository<Server>,
  ) {}

  async create(createServerDto: CreateServerDto): Promise<Server> {
    const server = this.serversRepository.create(createServerDto);
    return this.serversRepository.save(server);
  }

  async findAll(): Promise<Server[]> {
    return this.serversRepository.find();
  }

  async findOne(id: string): Promise<Server> {
    const server = await this.serversRepository.findOneBy({ id });
    if (!server) {
      throw new NotFoundException('Server not found');
    }
    return server;
  }

  async update(id: string, updateServerDto: UpdateServerDto): Promise<Server> {
    const server = await this.findOne(id);
    Object.assign(server, updateServerDto);
    return this.serversRepository.save(server);
  }

  async remove(id: string): Promise<void> {
    const server = await this.findOne(id);
    await this.serversRepository.remove(server);
  }
}
