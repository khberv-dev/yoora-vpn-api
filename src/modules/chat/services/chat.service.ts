import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { ChatRoom } from '../entity/chat-room.entity.js';
import { ChatMember } from '../entity/chat-member.entity.js';
import { ChatMessage } from '../entity/chat-message.entity.js';
import { User } from '../../user/entity/user.entity.js';
import { MessageType } from '../enum/message-type.enum.js';
import { MessageStatus } from '../enum/message-status.enum.js';
import { CreateRoomDto } from '../dto/create-room.dto.js';
import {
  messageTypeForMime,
  resolveUploadPath,
  toChatFilePath,
} from '../storage/chat-file.storage.js';
import {
  Paginated,
  PaginationQuery,
  paginate,
} from '../../../common/dto/pagination-query.dto.js';

const ROOM_NOT_FOUND = 'Chat room not found';

@Injectable()
export class ChatService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(ChatRoom) private readonly roomRepo: Repository<ChatRoom>,
    @InjectRepository(ChatMember)
    private readonly memberRepo: Repository<ChatMember>,
    @InjectRepository(ChatMessage)
    private readonly messageRepo: Repository<ChatMessage>,
  ) {}

  isMember(userId: string, roomId: string): Promise<boolean> {
    return this.memberRepo.exists({
      where: { chatRoom: { id: roomId }, user: { id: userId } },
    });
  }

  private async assertMember(userId: string, roomId: string): Promise<void> {
    if (!(await this.isMember(userId, roomId))) {
      throw new NotFoundException(ROOM_NOT_FOUND);
    }
  }

  async createRoom(userId: string, dto: CreateRoomDto): Promise<ChatRoom> {
    const memberIds = [...new Set([userId, ...dto.memberIds])];
    if (memberIds.length < 2) {
      throw new BadRequestException(
        'A chat room needs at least one other member',
      );
    }

    const roomId = await this.dataSource.transaction(async (manager) => {
      const found = await manager.countBy(User, { id: In(memberIds) });
      if (found !== memberIds.length) {
        throw new BadRequestException('Some members do not exist');
      }

      const room = await manager.save(manager.create(ChatRoom));
      await manager.save(
        ChatMember,
        memberIds.map((id) => ({ chatRoom: { id: room.id }, user: { id } })),
      );
      return room.id;
    });

    return this.getRoom(roomId);
  }

  private getRoom(roomId: string): Promise<ChatRoom> {
    return this.roomRepo.findOneOrFail({
      where: { id: roomId },
      relations: { members: { user: true } },
    });
  }

  async listRooms(
    userId: string,
    query: PaginationQuery,
  ): Promise<Paginated<ChatRoom>> {
    const [data, total] = await this.roomRepo
      .createQueryBuilder('room')
      .leftJoinAndSelect('room.members', 'member')
      .leftJoinAndSelect('member.user', 'user')
      .where((qb) => {
        const exists = qb
          .subQuery()
          .select('1')
          .from(ChatMember, 'me')
          .where('me.chat_room_id = room.id')
          .andWhere('me.user_id = :userId')
          .getQuery();
        return `EXISTS ${exists}`;
      })
      .setParameter('userId', userId)
      .orderBy('room.updatedAt', 'DESC')
      .skip(query.skip)
      .take(query.take)
      .getManyAndCount();
    return paginate(data, total, query);
  }

  async listRoomIdsForUser(userId: string): Promise<string[]> {
    const members = await this.memberRepo.find({
      where: { user: { id: userId } },
      relations: { chatRoom: true },
      select: { id: true, chatRoom: { id: true } },
    });
    return members.map((member) => member.chatRoom.id);
  }

  async listMemberIds(roomId: string): Promise<string[]> {
    const members = await this.memberRepo.find({
      where: { chatRoom: { id: roomId } },
      relations: { user: true },
      select: { id: true, user: { id: true } },
    });
    return members.map((member) => member.user.id);
  }

  async sendMessage(
    userId: string,
    roomId: string,
    text: string | undefined,
    file?: Express.Multer.File,
  ): Promise<ChatMessage> {
    await this.assertMember(userId, roomId);

    const body = text?.trim() || null;
    const type = file ? messageTypeForMime(file.mimetype) : MessageType.TEXT;
    if (!type) {
      throw new BadRequestException('Only photo and video files are allowed');
    }
    if (type === MessageType.TEXT && !body) {
      throw new BadRequestException('Message text or file is required');
    }

    const message = await this.messageRepo.save({
      chatRoom: { id: roomId },
      sender: { id: userId },
      type,
      text: body,
      filePath: file ? toChatFilePath(file.filename) : null,
      fileName: file?.originalname ?? null,
      fileSize: file?.size ?? null,
      fileMimeType: file?.mimetype ?? null,
    });
    await this.roomRepo.update(roomId, { updatedAt: new Date() });

    return this.messageRepo.findOneOrFail({
      where: { id: message.id },
      relations: { sender: true, chatRoom: true },
      select: { chatRoom: { id: true } },
    });
  }

  async listMessages(
    userId: string,
    roomId: string,
    query: PaginationQuery,
  ): Promise<{ page: Paginated<ChatMessage>; readIds: string[] }> {
    await this.assertMember(userId, roomId);

    const [data, total] = await this.messageRepo.findAndCount({
      where: { chatRoom: { id: roomId } },
      relations: { sender: true },
      order: { createdAt: 'DESC' },
      skip: query.skip,
      take: query.take,
    });

    const unread = data.filter(
      (message) =>
        message.status === MessageStatus.SENT && message.sender.id !== userId,
    );
    if (unread.length) {
      await this.messageRepo.update(
        { id: In(unread.map((message) => message.id)) },
        { status: MessageStatus.READ },
      );
      unread.forEach((message) => (message.status = MessageStatus.READ));
    }

    return {
      page: paginate(data, total, query),
      readIds: unread.map((message) => message.id),
    };
  }

  async getMessageFile(userId: string, messageId: string) {
    const message = await this.messageRepo.findOne({
      where: { id: messageId },
      relations: { chatRoom: true },
    });
    if (!message?.filePath) throw new NotFoundException('File not found');
    await this.assertMember(userId, message.chatRoom.id);

    return {
      path: resolveUploadPath(message.filePath),
      fileName: message.fileName ?? message.filePath,
      mimeType: message.fileMimeType,
    };
  }
}
