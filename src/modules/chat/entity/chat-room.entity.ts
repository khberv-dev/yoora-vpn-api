import {
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  type Relation,
  UpdateDateColumn,
} from 'typeorm';
import { ChatMember } from './chat-member.entity.js';
import { ChatMessage } from './chat-message.entity.js';

@Entity('chat_rooms')
export class ChatRoom {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @OneToMany(() => ChatMember, (member) => member.chatRoom)
  members: Relation<ChatMember[]>;

  @OneToMany(() => ChatMessage, (message) => message.chatRoom)
  messages: Relation<ChatMessage[]>;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
