import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { mkdir, readFile, writeFile } from 'fs/promises';
import { resolve, join } from 'path';
import { randomUUID } from 'crypto';
import type { Response } from 'express';

function imageType(b: Buffer) {
  if (b.length > 8 && b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) return 'image/png';
  if (b.length > 3 && b[0]===255 && b[1]===216 && b[2]===255) return 'image/jpeg';
  if (b.length > 12 && b.toString('ascii',0,4)==='RIFF' && b.toString('ascii',8,12)==='WEBP') return 'image/webp';
  return null;
}
const imageDirectory = () => resolve(process.env.AUDIO_STORAGE_DIR || 'storage/audio', 'content-images');
import { BadRequestException, NotFoundException, UploadedFile, UseInterceptors, Res, Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ContentService } from './content.service';
import { CreateContentDto, UpdateContentDto } from './dto/content.dto';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@Controller('contents')
export class ContentController {
  constructor(private readonly contentService: ContentService) {}

  @Post('images')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.OPERATOR)
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } }))
  async uploadImage(@UploadedFile() file: Express.Multer.File) {
    if (!file || !imageType(file.buffer)) throw new BadRequestException('Pilih gambar PNG, JPG, atau WebP, maksimal 5 MB.');
    await mkdir(imageDirectory(), { recursive: true });
    const id = randomUUID();
    await writeFile(join(imageDirectory(), id), file.buffer, { flag: 'wx' });
    return { mediaUrl: `/api/contents/images/${id}` };
  }

  @Public()
  @Get('images/:imageId')
  async image(@Param('imageId') id: string, @Res() res: Response) {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(id)) throw new NotFoundException();
    let buffer: Buffer;
    try { buffer = await readFile(join(imageDirectory(), id)); }
    catch (err) { if ((err as NodeJS.ErrnoException).code === 'ENOENT') throw new NotFoundException(); throw err; }
    res.setHeader('Content-Type', imageType(buffer) || 'application/octet-stream');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    return res.send(buffer);
  }

  @Public()
  @Get()
  list(@Query('activeOnly') activeOnly?: string) {
    return this.contentService.list(activeOnly === 'true');
  }

  @Post()
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.OPERATOR)
  create(@Body() dto: CreateContentDto) {
    return this.contentService.create(dto);
  }

  @Patch(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.OPERATOR)
  update(@Param('id') id: string, @Body() dto: UpdateContentDto) {
    return this.contentService.update(id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  remove(@Param('id') id: string) {
    return this.contentService.remove(id);
  }
}
