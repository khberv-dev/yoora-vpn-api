import { Module } from '@nestjs/common';
import { ChatModule } from '../chat/chat.module.js';
import { FileController } from './controllers/file.controller.js';
import { FileService } from './services/file.service.js';

@Module({
  imports: [ChatModule],
  controllers: [FileController],
  providers: [FileService],
})
export class FileModule {}
