import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, Repository } from 'typeorm';

import { CreateOperationAuditDto } from '../dto/create-operation-audit.dto';
import { OperationAuditQueryDto } from '../dto/operation-audit-query.dto';
import { UpdateOperationAuditDto } from '../dto/update-operation-audit.dto';
import {
  AiOperationAudit,
  type AiAuditOutcome,
} from '../entities/ai-operation-audit.entity';
import type { AiAccessContext } from '../types/ai-access-context.type';
import {
  assertAdmin,
  assertSelfFilter,
  paginatedResult,
  pagination,
} from './ai-scope.util';

export type RecordAiAuditInput = {
  action: string;
  resourceType: string;
  resourceId?: string | null;
  outcome?: AiAuditOutcome;
  metadata?: Record<string, unknown>;
  ipAddress?: string | null;
  userAgent?: string | null;
};

@Injectable()
export class AiOperationAuditsService {
  constructor(
    @InjectRepository(AiOperationAudit)
    private readonly auditsRepository: Repository<AiOperationAudit>,
  ) {}

  record(
    context: AiAccessContext,
    input: RecordAiAuditInput,
  ): Promise<AiOperationAudit> {
    const audit = this.auditsRepository.create({
      tenantId: context.tenantId,
      userId: context.userId,
      action: input.action,
      resourceType: input.resourceType,
      resourceId: input.resourceId ?? null,
      outcome: input.outcome ?? 'success',
      metadata: input.metadata ?? {},
      ipAddress: input.ipAddress ?? null,
      userAgent: input.userAgent ?? null,
    });

    return this.auditsRepository.save(audit);
  }

  create(
    context: AiAccessContext,
    dto: CreateOperationAuditDto,
  ): Promise<AiOperationAudit> {
    assertAdmin(context);
    return this.record(context, dto);
  }

  async findAll(context: AiAccessContext, query: OperationAuditQueryDto) {
    const { page, limit, skip } = pagination(query);
    const where: FindOptionsWhere<AiOperationAudit> = {
      tenantId: context.tenantId,
    };

    if (context.isAdmin) {
      if (query.userId) {
        where.userId = query.userId;
      }
    } else {
      assertSelfFilter(context, query.userId);
      where.userId = context.userId;
    }

    if (query.action) {
      where.action = query.action;
    }

    if (query.resourceType) {
      where.resourceType = query.resourceType;
    }

    if (query.outcome) {
      where.outcome = query.outcome;
    }

    const [data, total] = await this.auditsRepository.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip,
      take: limit,
    });

    return paginatedResult(data, total, page, limit);
  }

  async findOne(
    context: AiAccessContext,
    id: string,
  ): Promise<AiOperationAudit> {
    const where: FindOptionsWhere<AiOperationAudit> = {
      id,
      tenantId: context.tenantId,
    };

    if (!context.isAdmin) {
      where.userId = context.userId;
    }

    const audit = await this.auditsRepository.findOne({ where });

    if (!audit) {
      throw new NotFoundException('AI operation audit not found');
    }

    return audit;
  }

  async update(
    context: AiAccessContext,
    id: string,
    dto: UpdateOperationAuditDto,
  ): Promise<AiOperationAudit> {
    assertAdmin(context);
    const audit = await this.findOne(context, id);
    Object.assign(audit, dto);
    return this.auditsRepository.save(audit);
  }

  async remove(context: AiAccessContext, id: string) {
    assertAdmin(context);
    const audit = await this.findOne(context, id);
    await this.auditsRepository.remove(audit);
    return { id, deleted: true };
  }
}
