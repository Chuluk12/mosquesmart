import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { PlayerService } from './player.service';
import { PlayDto, SetVolumeDto } from './dto/play.dto';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole, TriggerType } from '@prisma/client';

@Controller('players')
export class PlayerController {
  constructor(private readonly playerService: PlayerService) {}

  @Get()
  list() {
    return this.playerService.list();
  }

  @Post(':deviceId/play')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.OPERATOR)
  play(@Param('deviceId') deviceId: string, @Body() dto: PlayDto, @CurrentUser() user: AuthUser) {
    return this.playerService.play(deviceId, dto.audioId, dto.volume, TriggerType.MANUAL, undefined, user.sub);
  }

  @Post(':deviceId/stop')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.OPERATOR)
  stop(@Param('deviceId') deviceId: string) {
    return this.playerService.stop(deviceId);
  }

  @Post(':deviceId/pause')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.OPERATOR)
  pause(@Param('deviceId') deviceId: string) {
    return this.playerService.pause(deviceId);
  }

  @Post(':deviceId/resume')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.OPERATOR)
  resume(@Param('deviceId') deviceId: string) {
    return this.playerService.resume(deviceId);
  }

  @Post(':deviceId/volume')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.OPERATOR)
  setVolume(@Param('deviceId') deviceId: string, @Body() dto: SetVolumeDto) {
    return this.playerService.setVolume(deviceId, dto.volume);
  }
}
