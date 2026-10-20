import { Injectable, NotFoundException } from '@nestjs/common';
import { ChatService } from '../../chat/services/chat.service.js';
import { isChatFilePath } from '../../chat/storage/chat-file.storage.js';

@Injectable()
export class FileService {
  constructor(private readonly chatService: ChatService) {}

  async resolve(userId: string, filePath: string): Promise<string> {
    const allowed =
      isChatFilePath(filePath) &&
      (await this.chatService.canAccessFile(userId, filePath));
    if (!allowed) throw new NotFoundException('File not found');
    return filePath;
  }
}
