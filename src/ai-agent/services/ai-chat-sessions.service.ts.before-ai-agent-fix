import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { AiChatSession } from '../entities/ai-chat-session.entity';
import type { AiChatMessage } from '../types/chat-message.type';

@Injectable()
export class AiChatSessionsService {
  constructor(
    @InjectRepository(AiChatSession)
    private readonly sessionsRepository: Repository<AiChatSession>,
  ) {}

  async create(title = 'New conversation') {
    const normalizedTitle = title.trim().slice(0, 120) || 'New conversation';

    const session = this.sessionsRepository.create({
      title: normalizedTitle,
      model: 'rule-based',
      status: 'active',
      messages: [],
    });

    return this.sessionsRepository.save(session);
  }

  async findAll() {
    const sessions = await this.sessionsRepository.find({
      order: {
        updatedAt: 'DESC',
      },
      take: 50,
    });

    return sessions.map((session) => ({
      id: session.id,
      title: session.title,
      model: session.model,
      status: session.status,
      messageCount: session.messages?.length ?? 0,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
    }));
  }

  async findOne(id: string) {
    const session = await this.sessionsRepository.findOneBy({
      id,
    });

    if (!session) {
      throw new NotFoundException(`Chat session ${id} was not found`);
    }

    return session;
  }

  async appendMessages(
    sessionId: string,
    messages: AiChatMessage[],
    model?: string,
  ) {
    const session = await this.findOne(sessionId);

    session.messages = [...(session.messages ?? []), ...messages];

    if (model) {
      session.model = model;
    }

    return this.sessionsRepository.save(session);
  }

  async remove(id: string) {
    const session = await this.findOne(id);

    await this.sessionsRepository.remove(session);

    return {
      id: session.id,
      deleted: true,
    };
  }
}
