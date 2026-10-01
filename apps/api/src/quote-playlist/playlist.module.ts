import { Module } from '@nestjs/common';
import { MosqueModule } from '../mosque/mosque.module';
import { PlayerModule } from '../player/player.module';
import { QuotePlaylistController } from './playlist.controller';
import { QuotePlaylistService } from './playlist.service';
@Module({ imports: [MosqueModule, PlayerModule], controllers: [QuotePlaylistController], providers: [QuotePlaylistService] })
export class QuotePlaylistModule {}