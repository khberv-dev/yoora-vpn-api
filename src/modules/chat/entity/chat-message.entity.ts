import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  type Relation,
} from 'typeorm';
import { ChatRoom } from './chat-room.entity.js';
import { User } from '../../user/entity/user.entity.js';
import { MessageType } from '../enum/message-type.enum.js';
import { MessageStatus } from '../enum/message-status.enum.js';

@Entity('chat_messages')
@Index(['chatRoom', 'createdAt'])
export class ChatMessage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => ChatRoom, (room) => room.messages, {
    onDelete: 'CASCADE',
    nullable: false,
  })
  @JoinColumn()
  chatRoom: Relation<ChatRoom>;

  @ManyToOne(() => User, {
    onDelete: 'CASCADE',
    nullable: false,
  })
  @JoinColumn()
  sender: Relation<User>;

  @Column({ type: 'enum', enum: MessageType })
  type: MessageType;

  @Column({ type: 'enum', enum: MessageStatus, default: MessageStatus.SENT })
  status: MessageStatus;

  @Column({ type: 'text', nullable: true })
  text: string | null;

  @Column({ type: 'varchar', nullable: true })
  filePath: string | null;

  @Column({ type: 'varchar', nullable: true })
  fileName: string | null;

  @Column({ type: 'int', nullable: true })
  fileSize: number | null;

  @Column({ type: 'varchar', nullable: true })
  fileMimeType: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
