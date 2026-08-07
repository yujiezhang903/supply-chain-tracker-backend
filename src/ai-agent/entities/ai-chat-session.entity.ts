import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { User } from '../../users/entities/user.entity';
import type { AiProvider } from '../types/ai-provider.type';
import type { AiChatMessage } from '../types/chat-message.type';

export const AI_CHAT_SESSION_STATUSES = [
  'active',
  'closed',
  'archived',
] as const;
export type AiChatSessionStatus = (typeof AI_CHAT_SESSION_STATUSES)[number];

@Entity('ai_chat_session')
@Check(
  'CHK_ai_chat_session_status',
  `"status" IN ('active', 'closed', 'archived')`,
)
@Index('IDX_ai_chat_session_tenant_user_updated', [
  'tenantId',
  'userId',
  'updatedAt',
])
@Index('IDX_ai_chat_session_tenant_status', ['tenantId', 'status'])
export class AiChatSession {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 64 })
  tenantId!: string;

  @Column({ type: 'uuid' })
  userId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: User;

  @Column({ type: 'varchar', length: 160, default: 'New conversation' })
  title!: string;

  @Column({ type: 'varchar', length: 80, default: 'rule-based' })
  model!: string;

  @Column({ type: 'varchar', length: 24, default: 'active' })
  status!: AiChatSessionStatus;

  @Column({ type: 'varchar', length: 32, default: 'mock' })
  provider!: AiProvider;

  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  messages!: AiChatMessage[];

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  metadata!: Record<string, unknown>;

  @Column({ type: 'timestamptz', nullable: true })
  closedAt!: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
