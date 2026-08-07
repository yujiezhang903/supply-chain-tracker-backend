import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { AiCacheService } from '../cache/ai-cache.service';
import { AiPaginationQueryDto } from '../dto/ai-pagination-query.dto';
import { CreateChatSessionDto } from '../dto/create-chat-session.dto';
import { UpdateChatSessionDto } from '../dto/update-chat-session.dto';
import { AiChatSession } from '../entities/ai-chat-session.entity';
import type { AiAccessContext } from '../types/ai-access-context.type';
import type { AiProvider } from '../types/ai-provider.type';
import type { AiChatMessage } from '../types/chat-message.type';
import { AiOperationAuditsService } from './ai-operation-audits.service';
import { assertSelfFilter, paginatedResult, pagination } from './ai-scope.util';

@Injectable()
export class AiChatSessionsService {
  constructor(
    @InjectRepository(AiChatSession)
    private readonly sessionsRepository: Repository<AiChatSession>,
    private readonly cacheService: AiCacheService,
    private readonly auditsService: AiOperationAuditsService,
  ) {}

  async create(
    context: AiAccessContext,
    dto: CreateChatSessionDto,
    initialMessages: AiChatMessage[] = [],
  ): Promise<AiChatSession> {
    const session = this.sessionsRepository.create({
      tenantId: context.tenantId,
      userId: context.userId,
      title: dto.title?.trim().slice(0, 160) || 'New conversation',
      provider: dto.provider ?? 'mock',
      model: 'rule-based',
      status: 'active',
      messages: initialMessages,
      metadata: dto.metadata ?? {},
      closedAt: null,
    });
    const saved = await this.sessionsRepository.save(session);

    await this.cacheService.appendSessionMessages(
      context,
      saved.id,
      initialMessages,
      () => [],
    );
    await this.auditsService.record(context, {
      action: 'session.create',
      resourceType: 'ai_chat_session',
      resourceId: saved.id,
    });

    return saved;
  }

  async findAll(context: AiAccessContext, query: AiPaginationQueryDto) {
    assertSelfFilter(context, query.userId);
    const { page, limit, skip } = pagination(query);
    const [data, total] = await this.sessionsRepository.findAndCount({
      where: {
        tenantId: context.tenantId,
        userId: context.userId,
      },
      order: { updatedAt: 'DESC' },
      skip,
      take: limit,
    });

    return paginatedResult(data, total, page, limit);
  }

  async findOne(context: AiAccessContext, id: string): Promise<AiChatSession> {
    const session = await this.sessionsRepository.findOne({
      where: {
        id,
        tenantId: context.tenantId,
        userId: context.userId,
      },
    });

    if (!session) {
      throw new NotFoundException('AI chat session not found');
    }

    return session;
  }

  async update(
    context: AiAccessContext,
    id: string,
    dto: UpdateChatSessionDto,
  ): Promise<AiChatSession> {
    const session = await this.findOne(context, id);

    Object.assign(session, dto);

    if (dto.status === 'closed') {
      session.closedAt = new Date();
    } else if (dto.status === 'active') {
      session.closedAt = null;
    }

    const saved = await this.sessionsRepository.save(session);
    await this.cacheService.clearSession(context, id);
    await this.auditsService.record(context, {
      action: 'session.update',
      resourceType: 'ai_chat_session',
      resourceId: id,
      metadata: { fields: Object.keys(dto) },
    });
    return saved;
  }

  async appendMessages(
    context: AiAccessContext,
    sessionId: string,
    messages: AiChatMessage[],
    model?: string,
    provider?: AiProvider,
    title?: string,
  ): Promise<AiChatSession> {
    const session = await this.findOne(context, sessionId);

    if (session.status !== 'active') {
      throw new ConflictException(
        'Messages cannot be added to a closed session',
      );
    }

    session.messages = [...(session.messages ?? []), ...messages];

    if (model) {
      session.model = model;
    }

    if (provider) {
      session.provider = provider;
    }

    if (title) {
      session.title = title;
    }

    const saved = await this.sessionsRepository.save(session);
    await this.cacheService.appendSessionMessages(
      context,
      sessionId,
      messages,
      () => saved.messages,
    );
    return saved;
  }

  async close(context: AiAccessContext, id: string): Promise<AiChatSession> {
    const session = await this.findOne(context, id);
    session.status = 'closed';
    session.closedAt = new Date();
    const saved = await this.sessionsRepository.save(session);

    await this.cacheService.clearSession(context, id);
    await this.auditsService.record(context, {
      action: 'session.close',
      resourceType: 'ai_chat_session',
      resourceId: id,
    });
    return saved;
  }

  async remove(context: AiAccessContext, id: string) {
    const session = await this.findOne(context, id);
    await this.sessionsRepository.remove(session);
    await this.cacheService.clearSession(context, id);
    await this.auditsService.record(context, {
      action: 'session.delete',
      resourceType: 'ai_chat_session',
      resourceId: id,
    });
    return { id, deleted: true };
  }
}
