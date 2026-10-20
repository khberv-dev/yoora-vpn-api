import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { ChatRoom } from './entity/chat-room.entity.js';
import { ChatMember } from './entity/chat-member.entity.js';
import { ChatMessage } from './entity/chat-message.entity.js';
import { UserModule } from '../user/user.module.js';
import { ChatService } from './services/chat.service.js';
import { ChatController } from './controllers/chat.controller.js';
import { ChatGateway } from './gateways/chat.gateway.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([ChatRoom, ChatMember, ChatMessage]),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.getOrThrow('JWT_ACCESS_SECRET'),
      }),
    }),
    UserModule,
  ],
  controllers: [ChatController],
  providers: [ChatService, ChatGateway],
})
export class ChatModule {}
