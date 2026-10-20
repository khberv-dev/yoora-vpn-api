import {
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  type Relation,
  Unique,
} from 'typeorm';
import { ChatRoom } from './chat-room.entity.js';
import { User } from '../../user/entity/user.entity.js';

@Entity('chat_members')
@Unique(['chatRoom', 'user'])
export class ChatMember {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => ChatRoom, (room) => room.members, {
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
  user: Relation<User>;

  @CreateDateColumn({ type: 'timestamptz' })
  joinedAt: Date;
}
