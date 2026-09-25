import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { AudioScheduleService } from './audio-schedule.service';
import { CreateAudioScheduleDto, UpdateAudioScheduleDto } from './dto/audio-schedule.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@Controller('audio-schedules')
export class AudioScheduleController {
  constructor(private readonly service: AudioScheduleService) {}

  @Get()
  list() {
    return this.service.list();
  }

  @Get('upcoming')
  upcoming() { return this.service.upcoming(); }

  @Post()
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.OPERATOR)
  create(@Body() dto: CreateAudioScheduleDto) {
    return this.service.create(dto);
  }

  @Patch(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.OPERATOR)
  update(@Param('id') id: string, @Body() dto: UpdateAudioScheduleDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
