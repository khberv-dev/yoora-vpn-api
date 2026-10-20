import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Namespace, Socket } from 'socket.io';
import { UserService } from '../../user/services/user.service.js';
import { ChatService } from '../services/chat.service.js';
import { ChatRoom } from '../entity/chat-room.entity.js';
import { ChatMessage } from '../entity/chat-message.entity.js';
import { readJwtIdentity } from '../../auth/utils/jwt-identity.util.js';

interface AuthedSocket extends Socket {
  data: { userId: string };
}

const roomKey = (roomId: string) => `room:${roomId}`;
const userKey = (userId: string) => `user:${userId}`;

@WebSocketGateway({ namespace: '/chat', cors: { origin: '*' } })
export class ChatGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(ChatGateway.name);

  @WebSocketServer() server: Namespace;

  constructor(
    private readonly jwtService: JwtService,
    private readonly userService: UserService,
    private readonly chatService: ChatService,
  ) {}

  afterInit(namespace: Namespace) {
    namespace.use((socket, next) => {
      void this.authenticate(socket).then(
        () => next(),
        () => next(new Error('Unauthorized')),
      );
    });
  }

  async handleConnection(socket: AuthedSocket) {
    const { userId } = socket.data;
    const roomIds = await this.chatService.listRoomIdsForUser(userId);
    await socket.join([userKey(userId), ...roomIds.map(roomKey)]);
    this.logger.log(`Connected user=${userId} rooms=${roomIds.length}`);
  }

  handleDisconnect(socket: AuthedSocket) {
    this.logger.log(
      `Disconnected user=${socket.data?.userId} socket=${socket.id}`,
    );
  }

  emitRoom(room: ChatRoom) {
    const userKeys = room.members.map((member) => userKey(member.user.id));
    this.server.in(userKeys).socketsJoin(roomKey(room.id));
    this.server.to(userKeys).emit('room', room);
  }

  emitMessage(message: ChatMessage) {
    this.server.to(roomKey(message.chatRoom.id)).emit('message', message);
  }

  emitRead(roomId: string, readerId: string, messageIds: string[]) {
    if (!messageIds.length) return;
    this.server
      .to(roomKey(roomId))
      .emit('read', { roomId, readerId, messageIds });
  }

  private async authenticate(socket: Socket) {
    const token = this.extractToken(socket);
    if (!token) throw new Error('Missing token');

    const { id } = readJwtIdentity(await this.jwtService.verifyAsync(token));
    const user = await this.userService.findById(id);
    if (!user) throw new Error('User not found');

    socket.data.userId = user.id;
  }

  private extractToken(socket: Socket): string | null {
    const authToken = (socket.handshake.auth as { token?: string } | undefined)
      ?.token;
    if (authToken) return authToken;
    const header = socket.handshake.headers.authorization;
    if (header?.startsWith('Bearer ')) return header.slice(7);
    return null;
  }
}
