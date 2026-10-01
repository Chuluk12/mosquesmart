import { QuotePlaylistModule } from './quote-playlist/playlist.module';
import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { HealthController } from './health.controller';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { MosqueModule } from './mosque/mosque.module';
import { PrayerModule } from './prayer/prayer.module';
import { AgendaModule } from './agenda/agenda.module';
import { ContentModule } from './content/content.module';
import { AudioModule } from './audio/audio.module';
import { AudioScheduleModule } from './audio-schedule/audio-schedule.module';
import { PlayerModule } from './player/player.module';
import { SchedulerModule } from './scheduler/scheduler.module';
import { HistoryModule } from './history/history.module';
import { RealtimeModule } from './realtime/realtime.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

@Module({
  imports: [
    PrismaModule,
    RealtimeModule,
    AuthModule,
    MosqueModule,
    PrayerModule,
    AgendaModule,
    ContentModule,
    AudioModule,
    AudioScheduleModule,
    PlayerModule,
    SchedulerModule,
    QuotePlaylistModule,
    HistoryModule,
  ],
  controllers: [HealthController],
  providers: [
    // Global auth: every route requires a valid JWT unless annotated @Public().
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    // Global RBAC: routes annotated @Roles(...) are checked after auth passes.
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule {}
