import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MosqueService } from '../mosque/mosque.service';
import { CreateContentDto, UpdateContentDto } from './dto/content.dto';
import { RealtimeGateway } from '../realtime/realtime.gateway';

@Injectable()
export class ContentService {
  constructor(private readonly prisma: PrismaService, private readonly mosqueService: MosqueService, private readonly realtime: RealtimeGateway) {}

  async list(activeOnly = false) {
    const mosque = await this.mosqueService.getOrCreate();
    return this.prisma.content.findMany({
      where: { mosqueId: mosque.id, ...(activeOnly ? { isActive: true } : {}) },
      orderBy: { displayOrder: 'asc' },
    });
  }

  async create(dto: CreateContentDto) {
    const mosque = await this.mosqueService.getOrCreate();
    const created = await this.prisma.content.create({ data: { ...dto, mosqueId: mosque.id } });
    this.realtime.emit('content:updated', { action: 'create', id: created.id });
    return created;
  }

  async update(id: string, dto: UpdateContentDto) {
    await this.ensureExists(id);
    const updated = await this.prisma.content.update({ where: { id }, data: dto });
    this.realtime.emit('content:updated', { action: 'update', id });
    return updated;
  }

  async remove(id: string) {
    await this.ensureExists(id);
    await this.prisma.content.delete({ where: { id } });
    this.realtime.emit('content:updated', { action: 'delete', id });
    return { ok: true };
  }

  private async ensureExists(id: string) {
    const found = await this.prisma.content.findUnique({ where: { id } });
    if (!found) throw new NotFoundException('Content not found');
    return found;
  }
}
