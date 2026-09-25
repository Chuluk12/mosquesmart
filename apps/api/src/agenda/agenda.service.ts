import {hasAgendaImage} from './agenda-image';
import {resolveAgenda} from './recurrence';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MosqueService } from '../mosque/mosque.service';
import { CreateAgendaDto, UpdateAgendaDto } from './dto/agenda.dto';
import { RealtimeGateway } from '../realtime/realtime.gateway';

@Injectable()
export class AgendaService {
  constructor(private readonly prisma: PrismaService, private readonly mosqueService: MosqueService, private readonly realtime: RealtimeGateway) {}

  async list(activeOnly = false) {
    const mosque = await this.mosqueService.getOrCreate();
    const agendas = await this.prisma.agenda.findMany({
      where: { mosqueId: mosque.id, ...(activeOnly ? { isActive: true } : {}) },
      orderBy: { startDate: 'asc' },
    });
    return agendas.map(a=>({...resolveAgenda(a,mosque.timezone),hasImage:hasAgendaImage(a.id)})).sort((a,b)=>a.startDate.getTime()-b.startDate.getTime());
  }

  async create(dto: CreateAgendaDto) {
    const mosque = await this.mosqueService.getOrCreate();
    this.validateDates(dto);
    const created = await this.prisma.agenda.create({ data: { ...dto, mosqueId: mosque.id } });
    this.realtime.emit('agenda:updated', { action: 'create', id: created.id });
    return created;
  }

  async update(id: string, dto: UpdateAgendaDto) {
    const current = await this.ensureExists(id);
    this.validateDates({...current,...dto});
    const updated = await this.prisma.agenda.update({ where: { id }, data: dto });
    this.realtime.emit('agenda:updated', { action: 'update', id });
    return updated;
  }

  async remove(id: string) {
    await this.ensureExists(id);
    await this.prisma.agenda.delete({ where: { id } });
    this.realtime.emit('agenda:updated', { action: 'delete', id });
    return { ok: true };
  }

  private validateDates(a: {startDate: string | Date; endDate?: string | Date | null; repeatWeekly?: boolean}) {
    const start = new Date(a.startDate).getTime(), end = a.endDate ? new Date(a.endDate).getTime() : null;
    if (end !== null && end <= start) throw new BadRequestException('Jam selesai harus setelah jam mulai.');
    if (a.repeatWeekly && (end === null || end - start >= 604800000)) throw new BadRequestException('Agenda mingguan memerlukan waktu selesai dan durasi kurang dari 7 hari.');
  }

  async ensureExists(id: string) {
    const found = await this.prisma.agenda.findUnique({ where: { id } });
    if (!found) throw new NotFoundException('Agenda not found');
    return found;
  }
}
