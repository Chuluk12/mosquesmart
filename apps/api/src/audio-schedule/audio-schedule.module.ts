import { Module } from '@nestjs/common';
import { PrayerModule } from '../prayer/prayer.module';
import { MosqueModule } from '../mosque/mosque.module';
import { AudioScheduleController } from './audio-schedule.controller';
import { PublicAudioScheduleController } from './public-audio-schedule.controller';
import { AudioScheduleService } from './audio-schedule.service';

@Module({
  imports: [PrayerModule, MosqueModule],
  controllers: [AudioScheduleController, PublicAudioScheduleController],
  providers: [AudioScheduleService],
})
export class AudioScheduleModule {}
