import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';

import { User } from '../../users/entities/user.entity';

@Entity('ai_user_memory')
@Unique('UQ_ai_user_memory_scope_key', ['tenantId', 'userId', 'memoryKey'])
@Check('CHK_ai_user_memory_importance', '"importance" BETWEEN 1 AND 5')
@Index('IDX_ai_user_memory_tenant_user_updated', [
  'tenantId',
  'userId',
  'updatedAt',
])
@Index('IDX_ai_user_memory_expiry', ['expiresAt'])
export class AiUserMemory {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 64 })
  tenantId!: string;

  @Column({ type: 'uuid' })
  userId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: User;

  @Column({ type: 'varchar', length: 120 })
  memoryKey!: string;

  @Column({ type: 'varchar', length: 60, default: 'general' })
  category!: string;

  @Column({ type: 'jsonb' })
  content!: Record<string, unknown>;

  @Column({ type: 'smallint', default: 3 })
  importance!: number;

  @Column({ type: 'boolean', default: true })
  isActive!: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  expiresAt!: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
