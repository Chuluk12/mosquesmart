import { Module } from '@nestjs/common';
import { ContentController } from './content.controller';
import { ContentService } from './content.service';
import { MosqueModule } from '../mosque/mosque.module';

@Module({
  imports: [MosqueModule],
  controllers: [ContentController],
  providers: [ContentService],
})
export class ContentModule {}
