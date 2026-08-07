import {
  IsIP,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

import {
  AI_AUDIT_OUTCOMES,
  type AiAuditOutcome,
} from '../entities/ai-operation-audit.entity';

export class CreateOperationAuditDto {
  @IsString()
  @MaxLength(100)
  action!: string;

  @IsString()
  @MaxLength(100)
  resourceType!: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  resourceId?: string | null;

  @IsOptional()
  @IsIn(AI_AUDIT_OUTCOMES)
  outcome?: AiAuditOutcome;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;

  @IsOptional()
  @IsIP()
  ipAddress?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  userAgent?: string | null;
}
