import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ChatService } from '../services/chat.service.js';
import { ChatGateway } from '../gateways/chat.gateway.js';
import { CreateRoomDto } from '../dto/create-room.dto.js';
import { SendMessageDto } from '../dto/send-message.dto.js';
import {
  chatFileOptions,
  removeUploadedFile,
} from '../storage/chat-file.storage.js';
import { CurrentUser } from '../../../common/decorators/current-user.decorator.js';
import { PaginationQuery } from '../../../common/dto/pagination-query.dto.js';
import { User } from '../../user/entity/user.entity.js';

@Controller('chat')
export class ChatController {
  constructor(
    private readonly chatService: ChatService,
    private readonly chatGateway: ChatGateway,
  ) {}

  @Post('rooms')
  async createRoom(@CurrentUser() user: User, @Body() dto: CreateRoomDto) {
    const room = await this.chatService.createRoom(user.id, dto);
    this.chatGateway.emitRoom(room);
    return room;
  }

  @Get('rooms')
  listRooms(@CurrentUser() user: User, @Query() query: PaginationQuery) {
    return this.chatService.listRooms(user.id, query);
  }

  @Post('rooms/:id/messages')
  @UseInterceptors(FileInterceptor('file', chatFileOptions))
  async sendMessage(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) roomId: string,
    @Body() dto: SendMessageDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    try {
      const message = await this.chatService.sendMessage(
        user.id,
        roomId,
        dto.text,
        file,
      );
      this.chatGateway.emitMessage(message);
      return message;
    } catch (error) {
      await removeUploadedFile(file);
      throw error;
    }
  }

  @Get('rooms/:id/messages')
  async listMessages(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) roomId: string,
    @Query() query: PaginationQuery,
  ) {
    const { page, readIds } = await this.chatService.listMessages(
      user.id,
      roomId,
      query,
    );
    this.chatGateway.emitRead(roomId, user.id, readIds);
    return page;
  }
}
