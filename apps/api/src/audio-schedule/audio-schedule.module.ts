import { Module } from '@nestjs/common';
import { PrayerModule } from '../prayer/prayer.module';
import { MosqueModule } from '../mosque/mosque.module';
import { AudioScheduleController } from './audio-schedule.controller';
import { AudioScheduleService } from './audio-schedule.service';

@Module({
  imports: [PrayerModule, MosqueModule],
  controllers: [AudioScheduleController],
  providers: [AudioScheduleService],
})
export class AudioScheduleModule {}
