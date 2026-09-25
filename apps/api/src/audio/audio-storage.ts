import { existsSync, mkdirSync } from 'fs';
import { extname, join, resolve } from 'path';
import { randomUUID } from 'crypto';
import { BadRequestException } from '@nestjs/common';

export const AUDIO_STORAGE_DIR = resolve(process.env.AUDIO_STORAGE_DIR || join(process.cwd(), 'storage', 'audio'));

export function ensureAudioStorageDir() {
  if (!existsSync(AUDIO_STORAGE_DIR)) {
    mkdirSync(AUDIO_STORAGE_DIR, { recursive: true });
  }
}

// Extension is validated (not trusted from the client name) against this
// whitelist, and the stored filename is always a fresh UUID -- the
// original filename is never used on disk, which rules out path traversal
// and filename-based collisions/overwrites entirely.
export const ALLOWED_AUDIO_EXTENSIONS = ['.mp3', '.wav'];
export const ALLOWED_AUDIO_MIME_TYPES = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/x-wav', 'audio/wave'];
export const MAX_AUDIO_FILE_SIZE_BYTES = 100 * 1024 * 1024; // 100MB

export function buildSafeAudioFilename(originalName: string): string {
  const ext = extname(originalName).toLowerCase();
  if (!ALLOWED_AUDIO_EXTENSIONS.includes(ext)) {
    throw new BadRequestException(`Unsupported audio extension: ${ext}. Allowed: ${ALLOWED_AUDIO_EXTENSIONS.join(', ')}`);
  }
  return `${randomUUID()}${ext}`;
}
