import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import type { AiProvider } from '../types/ai-provider.type';
import type { AiChatMessage } from '../types/chat-message.type';

@Entity('ai_chat_sessions')
export class AiChatSession {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ default: 'New conversation' })
  title!: string;

  @Column({ default: 'rule-based' })
  model!: string;

  @Column({ default: 'active' })
  status!: string;

  @Column({ default: 'mock' })
  provider!: AiProvider;

  @Column({ type: 'uuid', nullable: true })
  userId!: string | null;

  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  messages!: AiChatMessage[];

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
