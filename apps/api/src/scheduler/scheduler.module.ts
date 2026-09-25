import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { SchedulerService } from './scheduler.service';
import { MosqueModule } from '../mosque/mosque.module';
import { PrayerModule } from '../prayer/prayer.module';
import { PlayerModule } from '../player/player.module';

@Module({
  imports: [ScheduleModule.forRoot(), MosqueModule, PrayerModule, PlayerModule],
  providers: [SchedulerService],
})
export class SchedulerModule {}
