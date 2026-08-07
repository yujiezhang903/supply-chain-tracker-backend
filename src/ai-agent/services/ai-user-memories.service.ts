import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { AiPaginationQueryDto } from '../dto/ai-pagination-query.dto';
import { CreateUserMemoryDto } from '../dto/create-user-memory.dto';
import { UpdateUserMemoryDto } from '../dto/update-user-memory.dto';
import { AiUserMemory } from '../entities/ai-user-memory.entity';
import type { AiAccessContext } from '../types/ai-access-context.type';
import { AiOperationAuditsService } from './ai-operation-audits.service';
import { assertSelfFilter, paginatedResult, pagination } from './ai-scope.util';

@Injectable()
export class AiUserMemoriesService {
  constructor(
    @InjectRepository(AiUserMemory)
    private readonly memoriesRepository: Repository<AiUserMemory>,
    private readonly auditsService: AiOperationAuditsService,
  ) {}

  async create(
    context: AiAccessContext,
    dto: CreateUserMemoryDto,
  ): Promise<AiUserMemory> {
    const memory = this.memoriesRepository.create({
      tenantId: context.tenantId,
      userId: context.userId,
      memoryKey: dto.memoryKey.trim(),
      category: dto.category?.trim() || 'general',
      content: dto.content,
      importance: dto.importance ?? 3,
      isActive: dto.isActive ?? true,
      expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
    });
    const saved = await this.memoriesRepository.save(memory);
    await this.auditsService.record(context, {
      action: 'memory.create',
      resourceType: 'ai_user_memory',
      resourceId: saved.id,
    });
    return saved;
  }

  async findAll(context: AiAccessContext, query: AiPaginationQueryDto) {
    assertSelfFilter(context, query.userId);
    const { page, limit, skip } = pagination(query);
    const [data, total] = await this.memoriesRepository.findAndCount({
      where: { tenantId: context.tenantId, userId: context.userId },
      order: { updatedAt: 'DESC' },
      skip,
      take: limit,
    });
    return paginatedResult(data, total, page, limit);
  }

  async findOne(context: AiAccessContext, id: string): Promise<AiUserMemory> {
    const memory = await this.memoriesRepository.findOne({
      where: { id, tenantId: context.tenantId, userId: context.userId },
    });

    if (!memory) {
      throw new NotFoundException('AI user memory not found');
    }

    return memory;
  }

  async update(
    context: AiAccessContext,
    id: string,
    dto: UpdateUserMemoryDto,
  ): Promise<AiUserMemory> {
    const memory = await this.findOne(context, id);
    Object.assign(memory, {
      ...dto,
      expiresAt:
        dto.expiresAt === undefined
          ? memory.expiresAt
          : dto.expiresAt
            ? new Date(dto.expiresAt)
            : null,
    });
    const saved = await this.memoriesRepository.save(memory);
    await this.auditsService.record(context, {
      action: 'memory.update',
      resourceType: 'ai_user_memory',
      resourceId: id,
      metadata: { fields: Object.keys(dto) },
    });
    return saved;
  }

  async remove(context: AiAccessContext, id: string) {
    const memory = await this.findOne(context, id);
    await this.memoriesRepository.remove(memory);
    await this.auditsService.record(context, {
      action: 'memory.delete',
      resourceType: 'ai_user_memory',
      resourceId: id,
    });
    return { id, deleted: true };
  }
}
