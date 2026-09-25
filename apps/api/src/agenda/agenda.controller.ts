import { BadRequestException, Body, Controller, Delete, Get, Param, Patch, Post, Query, Res, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import type { Response } from 'express';
import {readFile,writeFile,unlink} from 'fs/promises';
import {agendaImagePath,hasAgendaImage} from './agenda-image';
import { AgendaService } from './agenda.service';
import { CreateAgendaDto, UpdateAgendaDto } from './dto/agenda.dto';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@Controller('agendas')
export class AgendaController {
  constructor(private readonly agendaService: AgendaService) {}

  @Post(':id/image')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.OPERATOR)
  @UseInterceptors(FileInterceptor('file',{storage:memoryStorage(),limits:{fileSize:5*1024*1024}}))
  async uploadImage(@Param('id') id:string,@UploadedFile() file:Express.Multer.File){
    await this.agendaService.ensureExists(id);
    if(!file||!imageType(file.buffer))throw new BadRequestException('Pilih gambar PNG, JPG, atau WebP (maksimal 5 MB).');
    await writeFile(agendaImagePath(id),file.buffer);
    await this.agendaService.update(id,{});
    return {ok:true};
  }
  @Public()
  @Get(':id/image')
  async image(@Param('id') id:string,@Res() res:Response){
    await this.agendaService.ensureExists(id);
    if(!hasAgendaImage(id))return res.status(404).end();
    const buffer=await readFile(agendaImagePath(id));
    res.setHeader('Content-Type',imageType(buffer)||'application/octet-stream');
    res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Cache-Control','no-cache');
    return res.send(buffer);
  }
  @Delete(':id/image')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.OPERATOR)
  async removeImage(@Param('id') id:string){
    await this.agendaService.ensureExists(id);
    await unlink(agendaImagePath(id)).catch(e=>{if(e.code!=='ENOENT')throw e;});
    await this.agendaService.update(id,{});return {ok:true};
  }

  @Public()
  @Get()
  list(@Query('activeOnly') activeOnly?: string) {
    return this.agendaService.list(activeOnly === 'true');
  }

  @Post()
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.OPERATOR)
  create(@Body() dto: CreateAgendaDto) {
    return this.agendaService.create(dto);
  }

  @Patch(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.OPERATOR)
  update(@Param('id') id: string, @Body() dto: UpdateAgendaDto) {
    return this.agendaService.update(id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  remove(@Param('id') id: string) {
    return this.agendaService.remove(id);
  }
}
function imageType(b:Buffer){
 if(b.length>8&&b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))return 'image/png';
 if(b.length>3&&b[0]===255&&b[1]===216&&b[2]===255)return 'image/jpeg';
 if(b.length>12&&b.toString('ascii',0,4)==='RIFF'&&b.toString('ascii',8,12)==='WEBP')return 'image/webp';
 return null;
}
