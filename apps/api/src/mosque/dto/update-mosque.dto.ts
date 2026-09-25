import { IsBoolean, IsInt, IsNumber, IsOptional, IsString, Min, Max, IsTimeZone, IsIn } from 'class-validator';

export class UpdateMosqueDto {
  @IsOptional() @IsBoolean() agendaSlidesEnabled?: boolean;
  @IsOptional() @IsInt() @Min(10) @Max(3600) prayerSlideSeconds?: number;
  @IsOptional() @IsInt() @Min(10) @Max(3600) agendaSlideSeconds?: number;
  @IsOptional() @IsIn(['default', 'kaaba', 'madinah', 'ottoman']) displayBackground?: string;
  @IsOptional() @IsIn(['classic', 'digital', 'analog', 'agenda', 'mihrab', 'panorama', 'board']) displayLayout?: string;
  @IsOptional() @IsIn(['sapphire', 'emerald', 'midnight']) displayTheme?: string;
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() address?: string;
  @IsOptional() @IsString() city?: string;
  @IsOptional() @IsString() province?: string;
  @IsOptional() @IsNumber() @Min(-90) @Max(90) latitude?: number;
  @IsOptional() @IsNumber() @Min(-180) @Max(180) longitude?: number;
  @IsOptional() @IsTimeZone() timezone?: string;
  @IsOptional() @IsString() logo?: string;
  @IsOptional() @IsString() runningText?: string;
}


