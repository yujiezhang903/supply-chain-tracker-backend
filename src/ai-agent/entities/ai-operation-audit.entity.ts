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

export const AI_AUDIT_OUTCOMES = ['success', 'denied', 'failure'] as const;
export type AiAuditOutcome = (typeof AI_AUDIT_OUTCOMES)[number];

@Entity('ai_operation_audit')
@Check(
  'CHK_ai_operation_audit_outcome',
  `"outcome" IN ('success', 'denied', 'failure')`,
)
@Index('IDX_ai_operation_audit_tenant_user_created', [
  'tenantId',
  'userId',
  'createdAt',
])
@Index('IDX_ai_operation_audit_tenant_action_created', [
  'tenantId',
  'action',
  'createdAt',
])
@Index('IDX_ai_operation_audit_resource', ['resourceType', 'resourceId'])
export class AiOperationAudit {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 64 })
  tenantId!: string;

  @Column({ type: 'uuid', nullable: true })
  userId!: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'userId' })
  user!: User | null;

  @Column({ type: 'varchar', length: 100 })
  action!: string;

  @Column({ type: 'varchar', length: 100 })
  resourceType!: string;

  @Column({ type: 'varchar', length: 128, nullable: true })
  resourceId!: string | null;

  @Column({ type: 'varchar', length: 24, default: 'success' })
  outcome!: AiAuditOutcome;

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  metadata!: Record<string, unknown>;

  @Column({ type: 'varchar', length: 45, nullable: true })
  ipAddress!: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  userAgent!: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
