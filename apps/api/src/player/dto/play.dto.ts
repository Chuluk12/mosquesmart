import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class PlayDto {
  @IsString() audioId!: string;
  @IsOptional() @IsInt() @Min(0) @Max(100) volume?: number;
}

export class SetVolumeDto {
  @IsInt() @Min(0) @Max(100) volume!: number;
}
