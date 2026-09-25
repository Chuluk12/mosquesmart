import { Module } from '@nestjs/common';
import { AudioController } from './audio.controller';
import { AudioService } from './audio.service';
import { MosqueModule } from '../mosque/mosque.module';

@Module({
  imports: [MosqueModule],
  controllers: [AudioController],
  providers: [AudioService],
  exports: [AudioService],
})
export class AudioModule {}
