import { Module } from '@nestjs/common';
import { SpeechService } from './speech.service';
import { AudioController } from './audio.controller';
import { AudioService } from './audio.service';
import { MosqueModule } from '../mosque/mosque.module';

@Module({
  imports: [MosqueModule],
  controllers: [AudioController],
  providers: [AudioService, SpeechService],
  exports: [AudioService],
})
export class AudioModule {}
