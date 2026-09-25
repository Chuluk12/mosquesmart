import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateMosqueDto } from './dto/update-mosque.dto';
import { RealtimeGateway } from '../realtime/realtime.gateway';

/**
 * The system manages exactly one mosque profile. getOrCreate() guarantees a
 * row always exists so the rest of the app (prayer engine, display, etc.)
 * never has to special-case "no mosque configured yet".
 */
@Injectable()
export class MosqueService {
  constructor(private readonly prisma: PrismaService, private readonly realtime: RealtimeGateway) {}

  async getOrCreate() {
    const existing = await this.prisma.mosque.findFirst();
    if (existing) return existing;
    return this.prisma.mosque.create({
      data: {
        name: 'Masjid Baru',
        timezone: 'Asia/Jakarta',
        runningText: 'Selamat datang di sistem informasi masjid',
      },
    });
  }

  async get() {
    return this.getOrCreate();
  }

  async update(dto: UpdateMosqueDto) {
    const mosque = await this.getOrCreate();
    const updated = await this.prisma.mosque.update({ where: { id: mosque.id }, data: dto });
    this.realtime.emit('mosque:updated', updated);
    return updated;
  }
}
