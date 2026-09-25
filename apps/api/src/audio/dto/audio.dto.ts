import { IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';
import { AudioCategory } from '@prisma/client';

export class UploadAudioMetaDto {
  @IsString() name!: string;
  @IsOptional() @IsString() description?: string;
  @IsEnum(AudioCategory) category!: AudioCategory;
}

export class UpdateAudioDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsEnum(AudioCategory) category?: AudioCategory;
  @IsOptional() @IsBoolean() isActive?: boolean;
}
