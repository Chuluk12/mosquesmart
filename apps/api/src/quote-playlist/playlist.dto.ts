import { ArrayMaxSize, ArrayMinSize, ArrayUnique, IsArray, IsBoolean, IsInt, IsString, Matches, Max, MaxLength, Min, MinLength } from 'class-validator';

export class PlaylistSettingsDto {
  @IsString() @MinLength(1) @MaxLength(100) @Matches(/\S/) name!: string;
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(24) @ArrayUnique()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { each: true }) times!: string[];
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(7) @ArrayUnique()
  @IsInt({ each: true }) @Min(0, { each: true }) @Max(6, { each: true }) daysOfWeek!: number[];
  @IsInt() @Min(0) @Max(100) volume!: number;
  @IsBoolean() isActive!: boolean;
}
export class CreatePlaylistDto extends PlaylistSettingsDto {
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(500) @ArrayUnique()
  @IsString({ each: true }) @MinLength(1, { each: true }) audioIds!: string[];
}
export class ApproveCycleDto {
  @IsInt() @Min(1) cycle!: number;
}
export class UpdatePlaylistAudiosDto {
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(500) @ArrayUnique()
  @IsString({ each: true }) @MinLength(1, { each: true }) audioIds!: string[];
}