import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

import {
  AI_AUDIT_OUTCOMES,
  type AiAuditOutcome,
} from '../entities/ai-operation-audit.entity';
import { AiPaginationQueryDto } from './ai-pagination-query.dto';

export class OperationAuditQueryDto extends AiPaginationQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  action?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  resourceType?: string;

  @IsOptional()
  @IsIn(AI_AUDIT_OUTCOMES)
  outcome?: AiAuditOutcome;
}
