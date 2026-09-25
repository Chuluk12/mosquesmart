import { Module } from '@nestjs/common';
import { AgendaController } from './agenda.controller';
import { AgendaService } from './agenda.service';
import { MosqueModule } from '../mosque/mosque.module';

@Module({
  imports: [MosqueModule],
  controllers: [AgendaController],
  providers: [AgendaService],
})
export class AgendaModule {}
