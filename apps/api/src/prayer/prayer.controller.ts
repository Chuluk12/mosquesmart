import { Body, Controller, Get, Param, Put, Post } from '@nestjs/common';
import { PrayerService } from './prayer.service';
import { UpdatePrayerSettingDto } from './dto/update-prayer-setting.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { Public } from '../common/decorators/public.decorator';
import { UserRole } from '@prisma/client';

@Controller('prayers')
export class PrayerController {
  constructor(private readonly prayerService: PrayerService) {}

  @Get('month/:year/:month')
  month(@Param('year') year: string, @Param('month') month: string) {
    return this.prayerService.getMonth(Number(year), Number(month));
  }

  @Post('month/:year/:month/refresh')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  refreshMonth(@Param('year') year: string, @Param('month') month: string) {
    return this.prayerService.getMonth(Number(year), Number(month), true);
  }

  @Public()
  @Get('today')
  today() {
    return this.prayerService.getToday();
  }

  @Public()
  @Get('date/:date')
  byDate(@Param('date') date: string) {
    return this.prayerService.getScheduleForDate(date);
  }

  @Get('settings')
  getSettings() {
    return this.prayerService.getSettings();
  }

  @Put('settings')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  updateSettings(@Body() dto: UpdatePrayerSettingDto) {
    return this.prayerService.updateSettings(dto);
  }

  @Post('prewarm')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  prewarm() {
    return this.prayerService.prewarm(7).then(() => ({ ok: true }));
  }
}
