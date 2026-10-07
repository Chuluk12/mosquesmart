import { ArrayUnique, ArrayMaxSize, IsArray, IsBoolean, IsDateString, IsEnum, IsInt, IsOptional, IsString, Matches, Max, Min, ValidateIf } from 'class-validator';
import { PrayerName, ScheduleType } from '@prisma/client';

const TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;

export class CreateAudioScheduleDto {
  @IsOptional() @IsBoolean() resumePlayback?: boolean;
  @IsOptional() @IsInt() @Min(1) @Max(1440) maxDurationMinutes?: number | null;
  @IsOptional() @IsInt() @Min(1) @Max(100) repeatCount?: number;
  @IsString() audioId!: string;
  @IsOptional() @IsArray() @ArrayMaxSize(20) @ArrayUnique() @IsString({ each: true }) audioIds?: string[];
  @IsOptional() @IsString() name?: string;
  @IsEnum(ScheduleType) scheduleType!: ScheduleType;

  @ValidateIf((o) => o.scheduleType === ScheduleType.PRAYER_RELATIVE)
  @IsEnum(PrayerName)
  prayerName?: PrayerName;

  @ValidateIf((o) => o.scheduleType === ScheduleType.PRAYER_RELATIVE)
  @IsInt() @Min(-120) @Max(120)
  offsetMinutes?: number;

  @ValidateIf((o) => o.scheduleType === ScheduleType.FIXED_TIME)
  @Matches(TIME_REGEX, { message: 'fixedTime must be HH:mm' })
  fixedTime?: string;

  @IsOptional() @IsArray() @ArrayMaxSize(7) @ArrayUnique() @IsInt({ each: true }) @Min(0, { each: true }) @Max(6, { each: true }) daysOfWeek?: number[];
  @IsOptional() @IsDateString() startDate?: string;
  @IsOptional() @IsDateString() endDate?: string;
  @IsOptional() @IsInt() @Min(0) @Max(100) volume?: number;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class UpdateAudioScheduleDto {
  @IsOptional() @IsBoolean() resumePlayback?: boolean;
  @IsOptional() @IsInt() @Min(1) @Max(1440) maxDurationMinutes?: number | null;
  @IsOptional() @IsInt() @Min(1) @Max(100) repeatCount?: number;
  @IsOptional() @IsString() audioId?: string;
  @IsOptional() @IsArray() @ArrayMaxSize(20) @ArrayUnique() @IsString({ each: true }) audioIds?: string[];
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsEnum(ScheduleType) scheduleType?: ScheduleType;
  @IsOptional() @IsEnum(PrayerName) prayerName?: PrayerName;
  @IsOptional() @IsInt() @Min(-120) @Max(120) offsetMinutes?: number;
  @IsOptional() @Matches(TIME_REGEX, { message: 'fixedTime must be HH:mm' }) fixedTime?: string;
  @IsOptional() @IsArray() @ArrayMaxSize(7) @ArrayUnique() @IsInt({ each: true }) @Min(0, { each: true }) @Max(6, { each: true }) daysOfWeek?: number[];
  @IsOptional() @IsDateString() startDate?: string;
  @IsOptional() @IsDateString() endDate?: string;
  @IsOptional() @IsInt() @Min(0) @Max(100) volume?: number;
  @IsOptional() @IsBoolean() isActive?: boolean;
}
