import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { Public } from '../common/decorators/public.decorator';
import { AudioScheduleService } from './audio-schedule.service';
import { CreateAudioScheduleDto, UpdateAudioScheduleDto } from './dto/audio-schedule.dto';

@Public()
@Controller('public/audio-schedules')
export class PublicAudioScheduleController {
  constructor(private readonly service: AudioScheduleService) {}

  @Get()
  list() { return this.service.listPublic(); }

  @Get('audios')
  audios() { return this.service.listPublicAudios(); }

  @Get('upcoming')
  upcoming() { return this.service.upcoming(); }

  @Post()
  create(@Body() dto: CreateAudioScheduleDto) { return this.service.createPublic(dto); }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateAudioScheduleDto) { return this.service.updatePublic(id, dto); }

  @Delete(':id')
  remove(@Param('id') id: string) { return this.service.removePublic(id); }
}
