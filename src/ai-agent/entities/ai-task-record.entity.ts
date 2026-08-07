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
import { AiChatSession } from './ai-chat-session.entity';

export const AI_TASK_STATUSES = [
  'pending',
  'running',
  'completed',
  'failed',
  'cancelled',
] as const;
export type AiTaskStatus = (typeof AI_TASK_STATUSES)[number];

@Entity('ai_task_record')
@Check(
  'CHK_ai_task_record_status',
  `"status" IN ('pending', 'running', 'completed', 'failed', 'cancelled')`,
)
@Check('CHK_ai_task_record_progress', '"progress" BETWEEN 0 AND 100')
@Index('IDX_ai_task_record_tenant_user_status', [
  'tenantId',
  'userId',
  'status',
])
@Index('IDX_ai_task_record_session', ['sessionId'])
@Index('IDX_ai_task_record_updated', ['tenantId', 'updatedAt'])
export class AiTaskRecord {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 64 })
  tenantId!: string;

  @Column({ type: 'uuid' })
  userId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: User;

  @Column({ type: 'uuid', nullable: true })
  sessionId!: string | null;

  @ManyToOne(() => AiChatSession, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'sessionId' })
  session!: AiChatSession | null;

  @Column({ type: 'varchar', length: 100 })
  taskType!: string;

  @Column({ type: 'varchar', length: 200 })
  title!: string;

  @Column({ type: 'varchar', length: 24, default: 'pending' })
  status!: AiTaskStatus;

  @Column({ type: 'smallint', default: 0 })
  progress!: number;

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  input!: Record<string, unknown>;

  @Column({ type: 'jsonb', nullable: true })
  output!: Record<string, unknown> | null;

  @Column({ type: 'text', nullable: true })
  errorMessage!: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  startedAt!: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  completedAt!: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
