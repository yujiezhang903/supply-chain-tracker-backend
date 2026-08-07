import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { AiCacheService } from '../cache/ai-cache.service';
import { AiPaginationQueryDto } from '../dto/ai-pagination-query.dto';
import { CreateTaskRecordDto } from '../dto/create-task-record.dto';
import { UpdateTaskRecordDto } from '../dto/update-task-record.dto';
import { AiTaskRecord } from '../entities/ai-task-record.entity';
import type { AiAccessContext } from '../types/ai-access-context.type';
import { AiChatSessionsService } from './ai-chat-sessions.service';
import { AiOperationAuditsService } from './ai-operation-audits.service';
import { assertSelfFilter, paginatedResult, pagination } from './ai-scope.util';

@Injectable()
export class AiTaskRecordsService {
  constructor(
    @InjectRepository(AiTaskRecord)
    private readonly tasksRepository: Repository<AiTaskRecord>,
    private readonly sessionsService: AiChatSessionsService,
    private readonly cacheService: AiCacheService,
    private readonly auditsService: AiOperationAuditsService,
  ) {}

  async create(
    context: AiAccessContext,
    dto: CreateTaskRecordDto,
  ): Promise<AiTaskRecord> {
    if (dto.sessionId) {
      await this.sessionsService.findOne(context, dto.sessionId);
    }

    const task = this.tasksRepository.create({
      tenantId: context.tenantId,
      userId: context.userId,
      sessionId: dto.sessionId ?? null,
      taskType: dto.taskType.trim(),
      title: dto.title.trim(),
      status: dto.status ?? 'pending',
      progress: dto.progress ?? 0,
      input: dto.input ?? {},
      output: null,
      errorMessage: null,
      startedAt: dto.status === 'running' ? new Date() : null,
      completedAt: dto.status === 'completed' ? new Date() : null,
    });
    const saved = await this.tasksRepository.save(task);
    await this.auditsService.record(context, {
      action: 'task.create',
      resourceType: 'ai_task_record',
      resourceId: saved.id,
    });
    return saved;
  }

  async findAll(context: AiAccessContext, query: AiPaginationQueryDto) {
    assertSelfFilter(context, query.userId);
    const { page, limit, skip } = pagination(query);
    const [data, total] = await this.tasksRepository.findAndCount({
      where: { tenantId: context.tenantId, userId: context.userId },
      order: { updatedAt: 'DESC' },
      skip,
      take: limit,
    });
    return paginatedResult(data, total, page, limit);
  }

  async findOne(context: AiAccessContext, id: string): Promise<AiTaskRecord> {
    const task = await this.tasksRepository.findOne({
      where: { id, tenantId: context.tenantId, userId: context.userId },
    });

    if (!task) {
      throw new NotFoundException('AI task record not found');
    }

    return task;
  }

  async update(
    context: AiAccessContext,
    id: string,
    dto: UpdateTaskRecordDto,
  ): Promise<AiTaskRecord> {
    const task = await this.findOne(context, id);

    if (dto.sessionId) {
      await this.sessionsService.findOne(context, dto.sessionId);
    }

    Object.assign(task, dto, {
      startedAt:
        dto.startedAt === undefined
          ? task.startedAt
          : dto.startedAt
            ? new Date(dto.startedAt)
            : null,
      completedAt:
        dto.completedAt === undefined
          ? task.completedAt
          : dto.completedAt
            ? new Date(dto.completedAt)
            : null,
    });

    if (dto.status === 'running' && !task.startedAt) {
      task.startedAt = new Date();
    }

    if (dto.status === 'completed') {
      task.progress = 100;
      task.completedAt ??= new Date();
    }

    if (dto.status === 'failed' || dto.status === 'cancelled') {
      task.completedAt ??= new Date();
    }

    const saved = await this.tasksRepository.save(task);
    await this.auditsService.record(context, {
      action: 'task.update',
      resourceType: 'ai_task_record',
      resourceId: id,
      metadata: { fields: Object.keys(dto) },
    });
    return saved;
  }

  async remove(context: AiAccessContext, id: string) {
    const task = await this.findOne(context, id);
    await this.tasksRepository.remove(task);
    await this.cacheService.deleteTaskState(context, id);
    await this.auditsService.record(context, {
      action: 'task.delete',
      resourceType: 'ai_task_record',
      resourceId: id,
    });
    return { id, deleted: true };
  }
}
