import { Controller, Get } from '@nestjs/common';
import { Public } from '../common/decorators/public.decorator';
import { QuotePlaylistService } from './playlist.service';

@Public()
@Controller('public/quote-playlists')
export class PublicQuotePlaylistController {
  constructor(private readonly service: QuotePlaylistService) {}

  @Get('audios')
  audios() {
    return this.service.listPublicAudios();
  }

  @Get()
  list() {
    return this.service.listPublic();
  }
}
