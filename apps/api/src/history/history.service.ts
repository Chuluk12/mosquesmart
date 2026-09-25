import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PlaybackStatus, TriggerType } from '@prisma/client';

@Injectable()
export class HistoryService {
  constructor(private readonly prisma: PrismaService) {}

  async list(filters: { deviceId?: string; status?: PlaybackStatus; triggerType?: TriggerType; from?: string; to?: string; take?: number }) {
    return this.prisma.playbackHistory.findMany({
      where: {
        ...(filters.deviceId ? { playerDeviceId: filters.deviceId } : {}),
        ...(filters.status ? { status: filters.status } : {}),
        ...(filters.triggerType ? { triggerType: filters.triggerType } : {}),
        ...(filters.from || filters.to
          ? { startedAt: { ...(filters.from ? { gte: new Date(filters.from) } : {}), ...(filters.to ? { lte: new Date(filters.to) } : {}) } }
          : {}),
      },
      orderBy: { startedAt: 'desc' },
      take: filters.take ?? 100,
    });
  }
}
