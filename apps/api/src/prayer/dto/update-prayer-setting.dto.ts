import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';

export class UpdatePrayerSettingDto {
  @IsOptional() @IsIn(['MWL', 'EGYPT', 'KARACHI', 'KEMENAG', 'UMM_AL_QURA', 'ISNA'])
  calculationMethod?: string;

  @IsOptional() @IsInt() @Min(-30) @Max(30) fajrOffsetMin?: number;
  @IsOptional() @IsInt() @Min(-30) @Max(30) dhuhrOffsetMin?: number;
  @IsOptional() @IsInt() @Min(-30) @Max(30) asrOffsetMin?: number;
  @IsOptional() @IsInt() @Min(-30) @Max(30) maghribOffsetMin?: number;
  @IsOptional() @IsInt() @Min(-30) @Max(30) ishaOffsetMin?: number;

  @IsOptional() @IsInt() @Min(0) @Max(60) fajrIqomahMin?: number;
  @IsOptional() @IsInt() @Min(0) @Max(60) dhuhrIqomahMin?: number;
  @IsOptional() @IsInt() @Min(0) @Max(60) asrIqomahMin?: number;
  @IsOptional() @IsInt() @Min(0) @Max(60) maghribIqomahMin?: number;
  @IsOptional() @IsInt() @Min(0) @Max(60) ishaIqomahMin?: number;
}
