import { IsIn, IsNumber, IsString, Max, MaxLength, Min, MinLength, Matches } from 'class-validator';
export class SpeechDto {
  @IsString() @MinLength(1) @MaxLength(3000) @Matches(/\S/) text!: string;
  @IsIn(['id', 'id+f3']) voice!: string;
  @IsNumber() @Min(0.75) @Max(1.25) speed!: number;
}