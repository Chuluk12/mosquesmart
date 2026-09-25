import { Module } from '@nestjs/common';
import { PlayerController } from './player.controller';
import { PlayerService } from './player.service';
import { PlayerGateway } from './player.gateway';
import { MosqueModule } from '../mosque/mosque.module';
import { AudioModule } from '../audio/audio.module';

@Module({
  imports: [MosqueModule, AudioModule],
  controllers: [PlayerController],
  providers: [PlayerService, PlayerGateway],
  exports: [PlayerService],
})
export class PlayerModule {}
