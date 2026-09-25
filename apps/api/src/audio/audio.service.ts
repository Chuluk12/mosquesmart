import { Injectable, NotFoundException } from '@nestjs/common';
import { join } from 'path';
import { existsSync, unlinkSync } from 'fs';
import { PrismaService } from '../prisma/prisma.service';
import { MosqueService } from '../mosque/mosque.service';
import { UpdateAudioDto } from './dto/audio.dto';
import { AUDIO_STORAGE_DIR } from './audio-storage';
import { AudioCategory } from '@prisma/client';

@Injectable()
export class AudioService {
  constructor(private readonly prisma: PrismaService, private readonly mosqueService: MosqueService) {}

  async list(category?: AudioCategory, activeOnly = false) {
    const mosque = await this.mosqueService.getOrCreate();
    return this.prisma.audio.findMany({
      where: { mosqueId: mosque.id, ...(category ? { category } : {}), ...(activeOnly ? { isActive: true } : {}) },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const audio = await this.prisma.audio.findUnique({ where: { id } });
    if (!audio) throw new NotFoundException('Audio not found');
    return audio;
  }

  async create(params: { name: string; description?: string; category: AudioCategory; filename: string; mimeType: string; fileSize: number }) {
    const mosque = await this.mosqueService.getOrCreate();
    return this.prisma.audio.create({
      data: {
        mosqueId: mosque.id,
        name: params.name,
        description: params.description,
        category: params.category,
        filePath: params.filename,
        mimeType: params.mimeType,
        fileSize: params.fileSize,
      },
    });
  }

  async update(id: string, dto: UpdateAudioDto) {
    await this.findOne(id);
    return this.prisma.audio.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    const audio = await this.findOne(id);
    const fullPath = join(AUDIO_STORAGE_DIR, audio.filePath);
    if (existsSync(fullPath)) {
      try { unlinkSync(fullPath); } catch { /* best-effort cleanup; DB row removal is what matters */ }
    }
    await this.prisma.audio.delete({ where: { id } });
    return { ok: true };
  }

  filePathOf(audio: { filePath: string }) {
    return join(AUDIO_STORAGE_DIR, audio.filePath);
  }

  /** Resolves the public HTTP URL the player service will download/stream from. */
  publicUrl(id: string, apiBaseUrl: string) {
    return `${apiBaseUrl}/api/audio/${id}/file`;
  }
}
