import { IsBoolean, IsDateString, IsEnum, IsInt, IsOptional, IsString } from 'class-validator';
import { ContentType } from '@prisma/client';

export class CreateContentDto {
  @IsEnum(ContentType) type!: ContentType;
  @IsOptional() @IsString() title?: string;
  @IsOptional() @IsString() content?: string;
  @IsOptional() @IsString() mediaUrl?: string;
  @IsOptional() @IsInt() displayOrder?: number;
  @IsOptional() @IsDateString() startAt?: string;
  @IsOptional() @IsDateString() endAt?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class UpdateContentDto {
  @IsOptional() @IsEnum(ContentType) type?: ContentType;
  @IsOptional() @IsString() title?: string;
  @IsOptional() @IsString() content?: string;
  @IsOptional() @IsString() mediaUrl?: string;
  @IsOptional() @IsInt() displayOrder?: number;
  @IsOptional() @IsDateString() startAt?: string;
  @IsOptional() @IsDateString() endAt?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
}
