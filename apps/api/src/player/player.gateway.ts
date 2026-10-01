import {
  ConnectedSocket, MessageBody, OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit,
  SubscribeMessage, WebSocketGateway, WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { PlayerService } from './player.service';
import { PlaybackStatus } from '@prisma/client';

/**
 * Namespace used exclusively by physical Player Service processes (the
 * mini-PCs wired to amplifiers). Admin/Display clients never connect here --
 * they listen on RealtimeGateway's `/realtime` namespace instead. Keeping
 * them separate means a bug in one can't affect the other's socket state.
 */
@WebSocketGateway({ namespace: '/player', cors: { origin: '*' } })
export class PlayerGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server!: Server;

  constructor(private readonly playerService: PlayerService) {}

  afterInit(server: Server) {
    this.playerService.bindServer(server);
  }

  handleConnection() {
    // Nothing to do until the player identifies itself via player:register.
  }

  async handleDisconnect(client: Socket) {
    await this.playerService.handleDisconnect(client.id);
  }

  @SubscribeMessage('player:register')
  async register(@ConnectedSocket() client: Socket, @MessageBody() data: { deviceId: string; name: string }) {
    if (!data?.deviceId) return { event: 'player:registered', data: { ok: false, error: 'deviceId is required' } };
    const ip = client.handshake.address;
    await this.playerService.registerConnection(data.deviceId, data.name || data.deviceId, client.id, ip);
    client.join(`player:${data.deviceId}`);
    return { event: 'player:registered', data: { ok: true } };
  }

  @SubscribeMessage('player:heartbeat')
  async heartbeat(@MessageBody() data: { deviceId: string }) {
    if (data?.deviceId) await this.playerService.heartbeat(data.deviceId);
  }

  @SubscribeMessage('player:progress')
  async progress(@ConnectedSocket() client: Socket, @MessageBody() data: { deviceId: string; historyId: string; positionSeconds: number }) {
    if (!data?.deviceId || !data?.historyId || !client.rooms.has(`player:${data.deviceId}`)) return;
    await this.playerService.saveSchedulePosition(data.deviceId, data.historyId, data.positionSeconds);
  }

  @SubscribeMessage('player:status')
  async status(@ConnectedSocket() client: Socket, @MessageBody() data: { deviceId: string; historyId?: string; status: PlaybackStatus; errorMessage?: string; positionSeconds?: number }) {
    if (!data?.deviceId || !Object.values(PlaybackStatus).includes(data?.status) || !client.rooms.has('player:' + data.deviceId)) return;
    await this.playerService.reportStatus(data.deviceId, data.historyId, data.status, data.errorMessage, data.positionSeconds);
  }
}
