import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server } from 'socket.io';

/**
 * Broadcast-only channel consumed by Admin Web and Display TV (never by the
 * physical Player Service, which talks over the separate `/player`
 * namespace). Anything that changes shared state — mosque profile, agenda,
 * content, running text, prayer schedule, player/playback status — emits
 * an event here so every open screen updates without polling.
 */
@WebSocketGateway({ namespace: '/realtime', cors: { origin: '*' } })
export class RealtimeGateway {
  @WebSocketServer() server!: Server;

  emit(event: string, payload: unknown) {
    this.server?.emit(event, payload);
  }
}
