import { Controller, Get, Query } from '@nestjs/common';
import { HistoryService } from './history.service';
import { PlaybackStatus, TriggerType } from '@prisma/client';

@Controller('history')
export class HistoryController {
  constructor(private readonly historyService: HistoryService) {}

  @Get()
  list(
    @Query('deviceId') deviceId?: string,
    @Query('status') status?: PlaybackStatus,
    @Query('triggerType') triggerType?: TriggerType,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('take') take?: string,
  ) {
    return this.historyService.list({ deviceId, status, triggerType, from, to, take: take ? Number(take) : undefined });
  }
}
