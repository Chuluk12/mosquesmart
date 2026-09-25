import { Global, Module } from '@nestjs/common';
import { RealtimeGateway } from './realtime.gateway';

// Global so any feature module can inject RealtimeGateway without an
// explicit import cycle (Player, Mosque, Agenda, Content, Scheduler all
// need to broadcast on it, and Player itself is one of those consumers).
@Global()
@Module({
  providers: [RealtimeGateway],
  exports: [RealtimeGateway],
})
export class RealtimeModule {}
