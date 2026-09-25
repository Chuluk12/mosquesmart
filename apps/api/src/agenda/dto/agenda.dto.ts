import { IsBoolean, IsDateString, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateAgendaDto {
  @IsOptional() @IsString() @MaxLength(300) topic?: string;
  @IsOptional() @IsString() @MaxLength(300) speakerName?: string;
  @IsOptional() @IsString() @MaxLength(300) speakerRole?: string;
  @IsOptional() @IsString() @MaxLength(300) audience?: string;
  @IsOptional() @IsString() @MaxLength(300) invitation?: string;
  @IsOptional() @IsString() @MaxLength(300) quote?: string;

  @IsOptional() @IsBoolean() repeatWeekly?: boolean;
  @IsString() title!: string;
  @IsOptional() @IsString() description?: string;
  @IsDateString() startDate!: string;
  @IsOptional() @IsDateString() endDate?: string | null;
  @IsOptional() @IsString() location?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class UpdateAgendaDto {
  @IsOptional() @IsString() @MaxLength(300) topic?: string;
  @IsOptional() @IsString() @MaxLength(300) speakerName?: string;
  @IsOptional() @IsString() @MaxLength(300) speakerRole?: string;
  @IsOptional() @IsString() @MaxLength(300) audience?: string;
  @IsOptional() @IsString() @MaxLength(300) invitation?: string;
  @IsOptional() @IsString() @MaxLength(300) quote?: string;

  @IsOptional() @IsBoolean() repeatWeekly?: boolean;
  @IsOptional() @IsString() title?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsDateString() startDate?: string;
  @IsOptional() @IsDateString() endDate?: string | null;
  @IsOptional() @IsString() location?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
}
