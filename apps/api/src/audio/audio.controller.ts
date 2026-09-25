import {
  BadRequestException, Body, Controller, Delete, Get, Param, Patch, Post, Query, Res, UploadedFile, UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import type { Response } from 'express';
import type { Express } from 'express';
import { AudioService } from './audio.service';
import { UpdateAudioDto } from './dto/audio.dto';
import {
  ALLOWED_AUDIO_EXTENSIONS, ALLOWED_AUDIO_MIME_TYPES, AUDIO_STORAGE_DIR, MAX_AUDIO_FILE_SIZE_BYTES,
  buildSafeAudioFilename, ensureAudioStorageDir,
} from './audio-storage';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole, AudioCategory } from '@prisma/client';

ensureAudioStorageDir();

@Controller('audio')
export class AudioController {
  constructor(private readonly audioService: AudioService) {}

  @Get()
  list(@Query('category') category?: AudioCategory, @Query('activeOnly') activeOnly?: string) {
    return this.audioService.list(category, activeOnly === 'true');
  }

  @Post('upload')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.OPERATOR)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: AUDIO_STORAGE_DIR,
        filename: (_req, file, cb) => {
          try {
            cb(null, buildSafeAudioFilename(file.originalname));
          } catch (err) {
            cb(err as Error, '');
          }
        },
      }),
      limits: { fileSize: MAX_AUDIO_FILE_SIZE_BYTES },
      fileFilter: (_req, file, cb) => {
        if (!ALLOWED_AUDIO_MIME_TYPES.includes(file.mimetype)) {
          return cb(new BadRequestException(`Unsupported MIME type: ${file.mimetype}`), false);
        }
        cb(null, true);
      },
    }),
  )
  async upload(
    @UploadedFile() file: Express.Multer.File,
    @Body('name') name: string,
    @Body('description') description: string | undefined,
    @Body('category') category: AudioCategory,
  ) {
    if (!file) throw new BadRequestException('No file uploaded');
    if (!category || !Object.values(AudioCategory).includes(category)) {
      throw new BadRequestException('A valid category is required');
    }
    return this.audioService.create({
      name: name || file.originalname,
      description,
      category,
      filename: file.filename,
      mimeType: file.mimetype,
      fileSize: file.size,
    });
  }

  // Served without auth: the physical Player Service and the <audio> preview
  // tag both need direct access on the local network. Filenames are
  // server-generated UUIDs looked up only through the Audio id, so there is
  // no path-traversal or enumeration surface here.
  @Public()
  @Get(':id/file')
  async file(@Param('id') id: string, @Res() res: Response) {
    const audio = await this.audioService.findOne(id);
    return res.sendFile(this.audioService.filePathOf(audio));
  }

  @Patch(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.OPERATOR)
  update(@Param('id') id: string, @Body() dto: UpdateAudioDto) {
    return this.audioService.update(id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  remove(@Param('id') id: string) {
    return this.audioService.remove(id);
  }
}
