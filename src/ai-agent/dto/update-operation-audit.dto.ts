import { IsIn, IsObject, IsOptional } from 'class-validator';

import {
  AI_AUDIT_OUTCOMES,
  type AiAuditOutcome,
} from '../entities/ai-operation-audit.entity';

export class UpdateOperationAuditDto {
  @IsOptional()
  @IsIn(AI_AUDIT_OUTCOMES)
  outcome?: AiAuditOutcome;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
