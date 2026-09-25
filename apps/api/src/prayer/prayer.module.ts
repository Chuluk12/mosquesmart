import { Module } from '@nestjs/common';
import { PrayerController } from './prayer.controller';
import { PrayerService } from './prayer.service';
import { AladhanPrayerProvider } from './providers/aladhan.provider';
import { PRAYER_PROVIDER } from './providers/prayer-provider.interface';
import { MosqueModule } from '../mosque/mosque.module';

@Module({
  imports: [MosqueModule],
  controllers: [PrayerController],
  providers: [
    PrayerService,
    AladhanPrayerProvider,
    { provide: PRAYER_PROVIDER, useExisting: AladhanPrayerProvider },
  ],
  exports: [PrayerService],
})
export class PrayerModule {}
